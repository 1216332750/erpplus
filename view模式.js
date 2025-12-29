// ==UserScript==
// @name         建发ERP成本支付状态指示器
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  在成本行中添加支付状态指示器，未支付显示为红色，所有内容强制左对齐，集成防崩溃算法
// @author       Your Name
// @match        https://erp.lyplus.cn/Operation/ProJectCalculate/ProjectBalance.aspx*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

// ========== 1. 样式定义 ==========
GM_addStyle(`

    .status-container {
        display: flex;
        flex-direction: column;
        align-items: flex-start !important;
        justify-content: flex-start;
        text-align: left !important;
        margin-top: 4px;
        font-size: 12px;
        width: 100%;
    }


    .payment-status {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        padding: 2px 6px;
        border-radius: 4px;
        color: white !important;
        font-size: 11px;
        font-weight: 600;
        min-width: 50px;
        text-transform: uppercase;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        margin-bottom: 3px;
        height: 20px;
        line-height: 20px;
        cursor: default;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        text-align: left !important;
    }

    /* --- 状态颜色定义 --- */

    /* 1. 未支付：红色系 (醒目) */
    .status-unapplied {
        background: linear-gradient(145deg, #FF6B6B 0%, #EE5253 100%);
        border: 1px solid #ff4d4d; /* 增加一点边框增强立体感 */
    }

    /* 2. 已申请：橙色系 */
    .payment-status.status-applied {
        background: linear-gradient(145deg, #FFD166 0%, #FFB347 100%);
        color: #fff !important;
    }

    /* 3. 已支付：青绿色系 */
    .payment-status.status-paid {
        background: linear-gradient(145deg, #0BD9B3 0%, #00C896 100%);
    }

    /* 支付详情列表容器 */
    .payment-info-box {
        display: flex;
        flex-direction: column;
        align-items: flex-start; /* 左对齐 */
        width: 100%;
        margin-top: 2px;
    }

    /* 单条支付记录 */
    .payment-record {
        display: block;
        width: 100%; /* 占满整行 */
        box-sizing: border-box;
        margin-bottom: 2px;
        padding: 2px 4px;
        border-radius: 2px;
        background-color: rgba(0,0,0,0.02);
        font-size: 10px;
        color: #666;
        border-left: 3px solid #ccc;
        line-height: 1.4;
        text-align: left !important; /* 文字左对齐 */
    }

    .payment-record.paid {
        background-color: rgba(0, 200, 150, 0.05);
        border-left-color: #00C896;
        color: #007a5e;
    }

    .payment-record.applied {
        background-color: rgba(255, 179, 71, 0.05);
        border-left-color: #FFB347;
        color: #b57b0e;
    }

    .payment-amount {
        font-weight: 700;
        margin-right: 5px;
    }

    .reverse-match-tag {
        display: inline-block;
        transform: scale(0.8);
        transform-origin: left center;
        background: #9370DB;
        color: white;
        padding: 0 4px;
        border-radius: 3px;
        margin-left: 4px;
        vertical-align: middle;
    }

    /* 底部合计样式 */
    .total-finance-summary {
        display: inline-block;
        text-align: left !important; /* 强制左对齐 */
        margin-top: 5px;
        padding: 5px 10px;
        background: #f9f9f9;
        border: 1px solid #eee;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.6;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .summary-paid { color: #00C896; font-weight: bold; }
    .summary-applied { color: #FFB347; }
`);

// 全局变量
let financeData = {
    fiFKApplyList: [],
    totalPaid: 0,
    totalApplied: 0
};

// ========== 2. 辅助函数 ==========

// 客户名称清洗
function normalizeCustomerName(name) {
    if (!name || typeof name !== 'string') return '未知';
    let normalized = name.replace(/[\s,，()（）【】\[\]{}【】"'\‘\’\“\”\`]/g, '').trim().toLowerCase();
    const suffixes = ['有限公司', '有限责任公司', '公司', '集团', '集团有限公司', '企业', '实业有限公司', '中心', '商行', '商店', '店铺', '贸易行', '办事处'];
    suffixes.forEach(s => { if (normalized.endsWith(s)) normalized = normalized.substring(0, normalized.length - s.length); });
    const prefixes = ['深圳市', '广州', '广东省', '广东', '北京', '上海', '杭州', '厦门'];
    prefixes.forEach(p => { if (normalized.startsWith(p)) normalized = normalized.substring(p.length); });
    return normalized || '未知';
}

// 备注模糊匹配
function checkDemoMatch(costDemo, financeDemo) {
    if (!costDemo || !financeDemo) return false;
    const c = costDemo.toLowerCase();
    const f = financeDemo.toLowerCase();
    if (c === f) return true;
    if (c.includes(f) || f.includes(c)) return true;
    const d1 = c.match(/\d{4,}/g);
    const d2 = f.match(/\d{4,}/g);
    if (d1 && d2) {
        return d1.some(n => d2.includes(n));
    }
    return false;
}

// ========== 3. 算法核心  ==========

function findSubsetIndices(target, items) {
    const targetCents = Math.round(target * 100);
    const candidates = items
        .map((item, index) => ({ val: Math.round(item.amount * 100), index }))
        .filter(item => item.val > 0 && item.val <= targetCents + 1);


    const exactMatch = candidates.find(c => Math.abs(c.val - targetCents) <= 1);
    if (exactMatch) return [exactMatch.index];


    if (candidates.length <= 15) {
        return searchDFS(targetCents, candidates);
    }


    return searchGreedyRandom(targetCents, candidates);
}

function searchDFS(target, pool) {
    const result = [];
    const stack = [];
    function backtrack(startIndex, currentSum) {
        if (result.length > 0) return;
        if (Math.abs(currentSum - target) <= 1) {
            result.push(...stack);
            return;
        }
        if (currentSum > target + 1) return;
        for (let i = startIndex; i < pool.length; i++) {
            stack.push(pool[i].index);
            backtrack(i + 1, currentSum + pool[i].val);
            if (result.length > 0) return;
            stack.pop();
        }
    }
    pool.sort((a, b) => b.val - a.val);
    backtrack(0, 0);
    return result;
}

function searchGreedyRandom(target, pool) {
    const maxTries = 50;
    for (let t = 0; t < maxTries; t++) {
        let currentTarget = target;
        const indices = [];
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        for (const item of shuffled) {
            if (item.val <= currentTarget + 1) {
                currentTarget -= item.val;
                indices.push(item.index);
                if (Math.abs(currentTarget) <= 1) return indices;
            }
        }
    }
    return [];
}

// ========== 4. 匹配逻辑 ==========

function directMatch(costData, financeList) {
    const sortedCost = costData.filter(i => !i.matched);
    const sortedFin = financeList.filter(i => !i.matched);

    sortedCost.forEach(cost => {
        const cAmt = cost.totalPrice;
        if (cAmt <= 0) return;
        const matches = sortedFin.filter(f => {
            const fAmt = parseFloat(f.RMBMoney || f.Amount || 0);
            return Math.abs(fAmt - cAmt) < 0.01;
        });
        const perfectMatch = matches.find(f => {
            return normalizeCustomerName(cost.customerName) === normalizeCustomerName(f.CustomerName) ||
                   checkDemoMatch(cost.demo, f.Demo);
        });
        if (perfectMatch) {
            applyMatch(cost, [perfectMatch], 'direct');
            perfectMatch.matched = true;
        }
    });
}

function sumMatchByCustomer(costData, financeList) {
    const costMap = {};
    costData.filter(c => !c.matched).forEach((c, idx) => {
        const key = normalizeCustomerName(c.customerName);
        if (!costMap[key]) costMap[key] = [];
        costMap[key].push({ cost: c, idx });
    });

    financeList.filter(f => !f.matched).forEach(fin => {
        const fName = normalizeCustomerName(fin.CustomerName);
        const fAmt = parseFloat(fin.RMBMoney || fin.Amount || 0);
        let candidates = costMap[fName] || [];

        if (candidates.length === 0) return;

        const algoInput = candidates.map(c => ({ amount: c.cost.totalPrice, origItem: c }));
        const indices = findSubsetIndices(fAmt, algoInput);

        if (indices.length > 0) {
            const matchedCosts = indices.map(i => algoInput[i].origItem.cost);
            matchedCosts.forEach(c => applyMatch(c, [fin], 'sum'));
            fin.matched = true;
            indices.sort((a, b) => b - a).forEach(i => candidates.splice(i, 1));
        }
    });
}

function reverseSumMatch(costData, financeList) {
    costData.filter(c => !c.matched).forEach(cost => {
        const cName = normalizeCustomerName(cost.customerName);
        const cAmt = cost.totalPrice;
        let candidates = financeList.filter(f => !f.matched && normalizeCustomerName(f.CustomerName) === cName);
        if (candidates.length === 0 && cost.demo) {
             candidates = financeList.filter(f => !f.matched && checkDemoMatch(cost.demo, f.Demo));
        }
        if (candidates.length === 0) return;

        const algoInput = candidates.map((f, idx) => ({
            amount: parseFloat(f.RMBMoney || f.Amount || 0),
            fin: f
        }));

        const indices = findSubsetIndices(cAmt, algoInput);
        if (indices.length > 0) {
            const matchedFins = indices.map(i => algoInput[i].fin);
            applyMatch(cost, matchedFins, 'reverse');
            matchedFins.forEach(f => f.matched = true);
        }
    });
}

function applyMatch(costItem, financeItems, type) {
    costItem.matched = true;
    costItem.matchType = type;
    costItem.matchedRecords = financeItems.map(f => ({
        amount: parseFloat(f.RMBMoney || f.Amount || 0),
        date: (f.VouchArriveDate || '').split(' ')[0],
        status: f.HandleStatusDes === "财务已确认" ? 'paid' : 'applied',
        demo: f.Demo || '',
        id: f.uniqueId
    }));
    const allPaid = costItem.matchedRecords.every(r => r.status === 'paid');
    costItem.paymentStatus = allPaid ? 'paid' : 'applied';
}

// ========== 5. DOM与渲染 (UI修改重点) ==========

function getProjectId() {
    return document.getElementById('hidProjectID')?.value;
}

function extractCostDataFromDOM() {
    const rows = document.querySelectorAll('tr[tag="projectproduct"]');
    return Array.from(rows).map(row => {
        const idx = row.getAttribute('objIndex');
        const priceEl = document.querySelector(`#txtTotalPrice${idx}`) || document.querySelector(`#spanTotalPrice${idx}`);
        const totalPrice = priceEl ? parseFloat(priceEl.value || priceEl.textContent || 0) : 0;

        let customerName = '';
        const custEl = document.querySelector(`#divSelectCustomerBox${idx}`);
        if (custEl) {
            customerName = custEl.querySelector('input') ? custEl.querySelector('input').value : custEl.textContent;
            customerName = customerName.replace('选择清空', '').trim();
        }

        const demoEl = document.querySelector(`#txtProductDemo${idx}`) || document.querySelector(`#spanProductDemo${idx}`);
        const demo = demoEl ? (demoEl.value || demoEl.textContent || '') : '';

        return {
            objIndex: idx,
            rowElement: row,
            totalPrice,
            customerName,
            demo,
            matched: false,
            paymentStatus: 'unapplied',
            matchedRecords: []
        };
    });
}

function renderStatusIndicators(costData) {
    costData.forEach(item => {
        const amountInput = item.rowElement.querySelector('.input_noborder') ||
                          item.rowElement.querySelector('input[id^="txtTotalPrice"]')?.parentNode ||
                          item.rowElement.querySelector('span[id^="spanTotalPrice"]')?.parentNode;

        if (!amountInput) return;

        let container = amountInput.parentNode.querySelector('.status-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'status-container';
            amountInput.parentNode.appendChild(container);
        }
        container.innerHTML = '';

        // 1. 创建状态胶囊
        const badge = document.createElement('span');

        // --- 变更：默认文字为“未支付”，默认样式为红色 ---
        let text = '未支付';
        let cls = 'status-unapplied';
        let title = '系统未找到匹配的支出记录';

        if (item.paymentStatus === 'paid') {
            text = '已支付';
            cls = 'status-paid';
            title = '财务已确认支付';
        } else if (item.paymentStatus === 'applied') {
            text = '已申请';
            cls = 'status-applied';
            title = '已提交支出申请';
        }

        badge.className = `payment-status ${cls}`;
        badge.textContent = text;
        badge.title = title;
        container.appendChild(badge);

        // 2. 显示详细记录
        if (item.matchedRecords.length > 0) {
            const infoBox = document.createElement('div');
            infoBox.className = 'payment-info-box';

            item.matchedRecords.forEach(rec => {
                const row = document.createElement('div');
                row.className = `payment-record ${rec.status}`;

                let html = `<span class="payment-amount">¥${rec.amount.toLocaleString('zh-CN')}</span><span style="color:#999">${rec.date}</span>`;
                if (item.matchType === 'reverse') {
                    html += `<span class="reverse-match-tag">拆分</span>`;
                } else if (item.matchType === 'sum') {
                    html += `<span class="reverse-match-tag" style="background:#4682B4">合并</span>`;
                }

                row.title = rec.demo || '无备注';
                row.innerHTML = html;
                infoBox.appendChild(row);
            });
            container.appendChild(infoBox);
        }
    });
}

function displayTotalSummary() {
    const targetCell = document.querySelector('#trCostSumBalance td:nth-child(11)') ||
                       document.querySelector('#trCostSumBalance td[align="right"]');

    if (targetCell) {
        const oldSum = targetCell.querySelector('.total-finance-summary');
        if (oldSum) oldSum.remove();

        const div = document.createElement('div');
        div.className = 'total-finance-summary';
        div.innerHTML = `
            <div style="font-weight:bold;margin-bottom:2px;color:#555">财务接口数据:</div>
            <div class="summary-paid">已支付: ¥${financeData.totalPaid.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
            <div class="summary-applied">已申请: ¥${financeData.totalApplied.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
        `;
        targetCell.appendChild(div);
    }
}

function toggleLoading(show, msg) {
    let el = document.getElementById('erp-calc-loading');
    if (!el) {
        el = document.createElement('div');
        el.id = 'erp-calc-loading';
        Object.assign(el.style, {
            position: 'fixed', top: '10px', right: '10px', padding: '8px 15px',
            background: 'rgba(24, 144, 255, 0.9)', color: '#fff', borderRadius: '4px', zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '13px', backdropFilter: 'blur(4px)'
        });
        document.body.appendChild(el);
    }
    el.textContent = msg || '处理中...';
    el.style.display = show ? 'block' : 'none';
    if (!show) setTimeout(() => el.remove(), 800);
}

// ========== 6. 初始化 ==========

async function init() {
    const pid = getProjectId();
    if (!pid) return setTimeout(init, 2000);

    toggleLoading(true, '正在同步财务数据...');

    try {
        await new Promise(resolve => {
            $.ajax({
                type: "GET",
                dataType: "json",
                url: "/ERPAJAX.ashx?METHAD=Finance.FinancePublic.PublicAjaxMethod.GetFiApplyDetailListByProjectIdList",
                data: { ProjectID: pid, RandPID: Math.random() },
                success: (data) => {
                    let list = Array.isArray(data) ? data : (data.List || data.fiFKApplyList || []);
                    financeData.fiFKApplyList = list.map((item, i) => ({
                        ...item,
                        uniqueId: `f-${i}`,
                        matched: false
                    }));

                    financeData.totalPaid = 0;
                    financeData.totalApplied = 0;
                    financeData.fiFKApplyList.forEach(f => {
                        const amt = parseFloat(f.RMBMoney || f.Amount || 0);
                        financeData.totalApplied += amt;
                        if (f.HandleStatusDes === "财务已确认") financeData.totalPaid += amt;
                    });
                    resolve();
                },
                error: () => resolve()
            });
        });

        const costData = extractCostDataFromDOM();
        const financeList = [...financeData.fiFKApplyList];

        toggleLoading(true, `正在匹配 ${costData.length} 条成本...`);

        directMatch(costData, financeList);
        sumMatchByCustomer(costData, financeList);
        reverseSumMatch(costData, financeList);

        renderStatusIndicators(costData);
        displayTotalSummary();

        toggleLoading(true, '匹配完成');
        setTimeout(() => toggleLoading(false), 1500);

    } catch (e) {
        console.error(e);
        toggleLoading(true, '插件运行错误');
    }
}

if (document.readyState === 'complete') setTimeout(init, 1000);
else window.addEventListener('load', () => setTimeout(init, 1000));

