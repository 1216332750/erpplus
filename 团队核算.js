// ==UserScript==
// @name         建发erp支付状态指示器（全状态显示版）
// @namespace    http://tampermonkey.net/
// @version      6.9
// @description  显示所有成本行的支付状态（含未支付），保留内存优化和DOM修复核心，使用左对齐经典配色
// @author       Your Name
// @match        https://erp.lyplus.cn/Operation/ProJectCalculate/ProjectBalanceView.aspx*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      erp.lyplus.cn
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    console.log('脚本开始执行 - 全状态显示版 v6.9');

    // --- 样式配置 (v3.2 经典风格) ---
    GM_addStyle(`
        /* 1. 容器：强制左对齐 */
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

        /* 2. 状态标签：方角、紧凑 */
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

        /* --- 颜色定义 --- */

        /* 未支付：红色系 (醒目) */
        .status-unapplied {
            background: linear-gradient(145deg, #FF6B6B 0%, #EE5253 100%);
            border: 1px solid #ff4d4d;
        }

        /* 已申请：橙色系 */
        .status-applied {
            background: linear-gradient(145deg, #FFD166 0%, #FFB347 100%);
            color: #fff !important;
            border: 1px solid #e09e35;
        }

        /* 已支付：青绿色系 */
        .status-paid {
            background: linear-gradient(145deg, #0BD9B3 0%, #00C896 100%);
            border: 1px solid #00b386;
        }

        /* 3. 支付详情列表 */
        .payment-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 100%;
            margin-top: 2px;
        }

        /* 单条记录：左侧边框风格 */
        .payment-record {
            display: block;
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 2px;
            padding: 2px 6px;
            border-radius: 2px;
            background-color: rgba(0,0,0,0.02);
            font-size: 11px;
            color: #666;
            border-left: 3px solid #ccc;
            line-height: 1.4;
            text-align: left !important;
        }

        /* 记录的具体状态颜色 */
        .record-paid {
            background-color: rgba(0, 200, 150, 0.05);
            border-left-color: #00C896;
            color: #007a5e;
        }

        .record-applied {
            background-color: rgba(255, 179, 71, 0.05);
            border-left-color: #FFB347;
            color: #b57b0e;
        }

        /* 拆分/合并 标签 */
        .reverse-match-tag {
            display: inline-block;
            transform: scale(0.85);
            background: #9370DB;
            color: white;
            padding: 0 4px;
            border-radius: 3px;
            margin-left: 4px;
        }

        /* 加载条 */
        #finance-loading-bar {
            position: fixed;
            top: 0; left: 0; height: 3px; background: #00C896;
            z-index: 99999; width: 0%; transition: width 0.3s;
        }

        /* 合计样式 */
        .total-summary-box {
            display: inline-block;
            text-align: left !important;
            padding: 5px 10px;
            background: #f9f9f9;
            border: 1px solid #eee;
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.6;
        }
        .total-paid { color: #00C896; font-weight: bold; }
        .total-applied { color: #FFB347; }
    `);

    // --- 全局状态 ---
    let financeData = {
        list: [],
        totalPaid: 0,
        totalApplied: 0
    };

    // --- 辅助函数 ---

    function getProjectId() {
        return document.getElementById('hidProjectId')?.value ||
               document.querySelector('input[name="hidProjectId"]')?.value;
    }

    function normalizeName(name) {
        if (!name) return "unknown";
        return name.replace(/[（(].*?[)）]|有限公司|责任公司|分公司|集团|[\s\d]/g, '').toLowerCase();
    }

    function isAmountEqual(a, b) {
        return Math.abs(a - b) < 0.02;
    }

    // --- 核心逻辑 ---

    function fetchFinanceData(projectId) {
        return new Promise((resolve, reject) => {
            const url = `https://erp.lyplus.cn/Finance/FinanceApplyOperation/FiApplySKorFKDetailView.aspx?ProjectID=${projectId}&MoneyType=0&PageMode=2&PageId=FKDetailView`;

            const bar = document.createElement('div');
            bar.id = 'finance-loading-bar';
            document.body.appendChild(bar);
            setTimeout(() => bar.style.width = '30%', 100);

            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    bar.style.width = '80%';
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, "text/html");
                        const jsonVal = doc.getElementById('hidSKorFkDetailJson')?.value;

                        if (jsonVal) {
                            let rawData = JSON.parse(jsonVal);
                            let list = Array.isArray(rawData) ? rawData : (rawData.fiFKApplyList || rawData.List || []);

                            financeData.list = list.map((item, idx) => ({
                                id: `fi_${idx}`,
                                amount: parseFloat(item.RMBMoney || item.Amount || 0),
                                status: item.HandleStatusDes,
                                customer: (item.CustomerName || "").trim(),
                                demo: (item.Demo || "").trim(),
                                date: item.VouchArriveDate || "",
                                matched: false
                            }));

                            financeData.list.forEach(item => {
                                financeData.totalApplied += item.amount;
                                if (item.status === "财务已确认") {
                                    financeData.totalPaid += item.amount;
                                }
                            });

                            bar.style.width = '100%';
                            setTimeout(() => bar.remove(), 500);
                            resolve();
                        } else {
                            throw new Error("无财务数据");
                        }
                    } catch (e) {
                        bar.style.backgroundColor = '#FF6B6B';
                        reject(e);
                    }
                }
            });
        });
    }

    // --- 匹配算法 (内存保护) ---

    function findSubsetIndices(targetAmount, items) {
        if (items.length > 16) {
            return findSubsetGreedy(targetAmount, items);
        }

        const targetCents = Math.round(targetAmount * 100);
        const itemsCents = items.map(i => Math.round(i.amount * 100));
        const result = [];
        let iterations = 0;
        const MAX_ITERATIONS = 50000;

        function dfs(index, currentSum, indices) {
            iterations++;
            if (iterations > MAX_ITERATIONS) return false;

            if (currentSum === targetCents) {
                result.push([...indices]);
                return true;
            }
            if (index >= itemsCents.length || currentSum > targetCents) {
                return false;
            }

            if (dfs(index + 1, currentSum + itemsCents[index], [...indices, index])) {
                return true;
            }
            if (dfs(index + 1, currentSum, indices)) {
                return true;
            }
            return false;
        }

        dfs(0, 0, []);
        return result[0] || [];
    }

    function findSubsetGreedy(targetAmount, items) {
        const sortedItems = items.map((item, idx) => ({...item, origIdx: idx}))
                                 .sort((a, b) => b.amount - a.amount);

        let currentSum = 0;
        let indices = [];

        for (let item of sortedItems) {
            if (currentSum + item.amount <= targetAmount + 0.001) {
                currentSum += item.amount;
                indices.push(item.origIdx);
            }
        }

        if (isAmountEqual(currentSum, targetAmount)) {
            return indices;
        }
        return [];
    }

    // --- 执行逻辑 ---

    function executeMatching(costRows) {
        console.log("开始执行匹配逻辑...");

        let costData = Array.from(costRows).map((row, idx) => {
            const objIndex = row.getAttribute('objIndex');
            const priceEl = row.querySelector(`[id^='spanTotalRMBPrice'], [id^='spanTotalPrice']`);
            const price = parseFloat(priceEl?.value || priceEl?.innerText || 0);

            const custEl = row.querySelector(`[id^='txtCustomer'], [id^='spanCustomer']`);
            const customer = (custEl?.value || custEl?.innerText || "").replace(/选择|清空/g, '').trim();

            return {
                rowIndex: idx,
                objIndex: objIndex,
                amount: price,
                customer: customer,
                normName: normalizeName(customer),
                matched: false,
                matches: [],
                rowElement: row
            };
        });

        // 1. 严格 1对1 匹配
        costData.forEach(cost => {
            if (cost.amount <= 0) return;

            const matchIdx = financeData.list.findIndex(fi =>
                !fi.matched &&
                isAmountEqual(fi.amount, cost.amount) &&
                (normalizeName(fi.customer) === cost.normName || (fi.demo && cost.customer.includes(fi.customer)))
            );

            if (matchIdx !== -1) {
                const fi = financeData.list[matchIdx];
                fi.matched = true;
                cost.matched = true;
                cost.matches.push(fi);
            }
        });

        // 2. 分组匹配
        const costGroups = {};
        const fiGroups = {};

        costData.filter(c => !c.matched && c.amount > 0).forEach(c => {
            if (!costGroups[c.normName]) costGroups[c.normName] = [];
            costGroups[c.normName].push(c);
        });

        financeData.list.filter(f => !f.matched).forEach(f => {
            const name = normalizeName(f.customer);
            if (!fiGroups[name]) fiGroups[name] = [];
            fiGroups[name].push(f);
        });

        Object.keys(costGroups).forEach(key => {
            const groupCosts = costGroups[key];
            const groupFis = fiGroups[key] || [];

            if (groupFis.length === 0) return;

            // 正向
            groupFis.forEach(fi => {
                if (fi.matched) return;
                const availableCosts = groupCosts.filter(c => !c.matched);
                if (availableCosts.length === 0) return;

                const matchedIndices = findSubsetIndices(fi.amount, availableCosts);
                if (matchedIndices.length > 0) {
                    fi.matched = true;
                    matchedIndices.forEach(idx => {
                        const cost = availableCosts[idx];
                        cost.matched = true;
                        cost.matches.push({ ...fi, isSumMatch: true });
                    });
                }
            });

            // 反向
            groupCosts.forEach(cost => {
                if (cost.matched) return;
                const availableFis = groupFis.filter(f => !f.matched);
                if (availableFis.length === 0) return;

                const matchedIndices = findSubsetIndices(cost.amount, availableFis);
                if (matchedIndices.length > 0) {
                    cost.matched = true;
                    matchedIndices.forEach(idx => {
                        const fi = availableFis[idx];
                        fi.matched = true;
                        cost.matches.push({ ...fi, isReverseMatch: true });
                    });
                }
            });
        });

        renderResults(costData);
        renderTotalSummary();
    }

    // 4. 渲染行内状态 (修复版：显示所有状态)
    function renderResults(costData) {
        costData.forEach(cost => {
            // 注意：这里不再跳过未匹配的项
            if (cost.amount <= 0) return; // 只跳过金额为0的

            const row = cost.rowElement;
            const targetCell = row.querySelector('td:nth-child(15)'); // 支付时间列
            const chkInput = row.querySelector('input[name="chkProjectProduct"]');

            if (!targetCell || !chkInput) return;

            const statusCell = chkInput.parentNode;

            // 清理旧状态
            const existingStatus = statusCell.querySelector('.status-container');
            if (existingStatus) existingStatus.remove();

            // 计算状态
            let statusClass = 'status-unapplied'; // 默认红色（未支付）
            let statusText = '未支付';

            if (cost.matches.length > 0) {
                const isFullyPaid = cost.matches.every(m => m.status === "财务已确认");
                statusClass = isFullyPaid ? 'status-paid' : 'status-applied';
                statusText = isFullyPaid ? '已支付' : '已申请';
            }

            // 插入状态标签
            const container = document.createElement('div');
            container.className = 'status-container';
            container.innerHTML = `<span class="payment-status ${statusClass}">${statusText}</span>`;

            // 安全插入 DOM
            if (chkInput.nextSibling) {
                statusCell.insertBefore(container, chkInput.nextSibling);
            } else {
                statusCell.appendChild(container);
            }

            // 只有当有匹配记录时才渲染详细信息
            if (cost.matches.length > 0) {
                let detailsHtml = '';
                cost.matches.forEach(m => {
                    const isPaid = m.status === "财务已确认";
                    const recordClass = isPaid ? 'record-paid' : 'record-applied';

                    const tag = m.isReverseMatch ? '<span class="reverse-match-tag">拆分</span>' :
                               (m.isSumMatch ? '<span class="reverse-match-tag">合并</span>' : '');
                    const dateStr = m.date ? m.date.substring(0, 10) : '';

                    detailsHtml += `
                        <div class="payment-record ${recordClass}">
                            <span style="font-weight:bold">¥${m.amount}</span>
                            <span style="color:#999; margin-left:4px">${dateStr}</span>
                            ${tag}
                        </div>
                    `;
                });
                targetCell.innerHTML = `<div class="payment-info">${detailsHtml}</div>`;
            }
        });
    }

    // 5. 渲染合计
    function renderTotalSummary() {
        const targetTd = document.querySelector('#trCostSumBalance td:nth-child(11)');
        if (targetTd) {
            targetTd.innerHTML = `
                <div class="total-summary-box">
                    <div>已支付: <span class="total-paid">¥${financeData.totalPaid.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</span></div>
                    <div>已申请: <span class="total-applied">¥${financeData.totalApplied.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</span></div>
                </div>
            `;
        }
    }

    async function init() {
        const pid = getProjectId();
        if (!pid) return;

        try {
            await fetchFinanceData(pid);
            const rows = document.querySelectorAll('tr[tag="projectproduct"]');
            if (rows.length > 0) {
                executeMatching(rows);
            }
        } catch (e) {
            console.error("ERP助手错误:", e);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('load', () => setTimeout(init, 1500));
    } else {
        setTimeout(init, 1500);
    }

})();