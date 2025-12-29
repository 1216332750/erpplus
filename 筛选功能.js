// ==UserScript==
// @name         表格增强工具（筛选+排序）-自动触发版
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  点击按钮自动填入文本并立即触发筛选
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const createElementWithText = (tag, text) => {
        const el = document.createElement(tag);
        el.textContent = text;
        return el;
    };

    const init = () => {
        const table = document.getElementById('tblProjectProduct');
        if (!table) {
            setTimeout(init, 500);
            return;
        }

        // 创建搜索容器
        const searchContainer = createElementWithText('div', '');
        searchContainer.style.margin = '10px 0';
        searchContainer.style.display = 'flex';
        searchContainer.style.alignItems = 'center';
        searchContainer.style.gap = '10px';
        searchContainer.style.flexWrap = 'wrap';

        // 创建搜索框
        const searchInput = createElementWithText('input', '');
        searchInput.type = 'text';
        searchInput.placeholder = '输入关键词筛选...';
        searchInput.style.padding = '8px';
        searchInput.style.width = '300px';
        searchInput.id = 'tableSearch';

        // 创建按钮容器
        const buttonContainer = createElementWithText('div', '');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.flexWrap = 'wrap';

        // 创建快速筛选按钮
        const createQuickFilterButton = (text) => {
            const button = createElementWithText('button', text);
            button.type = 'button';
            button.style.padding = '8px 12px';
            button.style.border = '1px solid #ddd';
            button.style.borderRadius = '4px';
            button.style.backgroundColor = '#f5f5f5';
            button.style.cursor = 'pointer';

            button.addEventListener('click', (e) => {
                e.preventDefault();
                // 填入搜索框
                searchInput.value = text;
                // 立即触发筛选
                filterTable(table, text.toLowerCase());
            });

            return button;
        };

        // 创建清除按钮
        const createClearButton = () => {
            const button = createElementWithText('button', '清除');
            button.type = 'button';
            button.style.padding = '8px 12px';
            button.style.border = '1px solid #ddd';
            button.style.borderRadius = '4px';
            button.style.backgroundColor = '#f5f5f5';
            button.style.cursor = 'pointer';

            button.addEventListener('click', (e) => {
                e.preventDefault();
                // 清空搜索框
                searchInput.value = '';
                // 立即触发筛选（显示所有行）
                filterTable(table, '');
            });

            return button;
        };

        // 创建按钮
        const paidButton = createQuickFilterButton('已支付');
        const appliedButton = createQuickFilterButton('已申请');
        const notAppliedButton = createQuickFilterButton('未支付');
        const clearButton = createClearButton();

        // 添加按钮
        buttonContainer.appendChild(paidButton);
        buttonContainer.appendChild(appliedButton);
        buttonContainer.appendChild(notAppliedButton);
        buttonContainer.appendChild(clearButton);

        // 创建捐赠咖啡广告 - 简洁优雅设计
        const donationAd = createElementWithText('div', '');
        donationAd.style.cssText = `
            margin: 8px 0;
            padding: 10px 15px;
            background: #ffffff;
            border: 1px solid #e1e5e9;
            border-left: 4px solid #28a745;
            border-radius: 6px;
            font-size: 13px;
            color: #495057;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        
        donationAd.innerHTML = `
            <span style="color: #8B4513;">☕</span> 
            工具好用吗？
            <span style="color: #007bff; text-decoration: underline;">请开发者喝杯咖啡</span>
            <span style="color: #8B4513;">☕</span>
        `;

        // 悬停效果
        donationAd.addEventListener('mouseenter', () => {
            donationAd.style.borderLeftColor = '#007bff';
            donationAd.style.boxShadow = '0 2px 8px rgba(0,123,255,0.15)';
            donationAd.style.transform = 'translateX(2px)';
        });

        donationAd.addEventListener('mouseleave', () => {
            donationAd.style.borderLeftColor = '#28a745';
            donationAd.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            donationAd.style.transform = 'translateX(0)';
        });

        // 创建温馨的提示弹窗
        const createDonationModal = () => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.4);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                backdrop-filter: blur(2px);
            `;

            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                padding: 25px;
                border-radius: 12px;
                text-align: center;
                width: 300px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                position: relative;
            `;

            // 关闭按钮
            const closeBtnX = document.createElement('div');
            closeBtnX.innerHTML = '×';
            closeBtnX.style.cssText = `
                position: absolute;
                top: 8px;
                right: 12px;
                font-size: 24px;
                color: #999;
                cursor: pointer;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            `;

            closeBtnX.addEventListener('mouseenter', () => {
                closeBtnX.style.background = '#f5f5f5';
                closeBtnX.style.color = '#333';
            });

            closeBtnX.addEventListener('mouseleave', () => {
                closeBtnX.style.background = 'transparent';
                closeBtnX.style.color = '#999';
            });

            closeBtnX.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            const title = createElementWithText('h3', '谢谢你');
            title.style.cssText = `
                margin: 0 0 15px 0;
                color: #333;
                font-size: 18px;
                font-weight: 600;
            `;

            const content = createElementWithText('div', '');
            content.innerHTML = `
                <p style="margin: 0 0 15px 0; color: #555; font-size: 14px; line-height: 1.6;">
                    为了身体的健康，我已经戒掉了咖啡，谢谢你的好意，我心领了。
                </p>
                <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">
                    我制作这个工具是为了让你早点下班，有时间陪伴父母、孩子和爱人，不是让你能者多劳。
                </p>
            `;

            const blessing = createElementWithText('div', '');
            blessing.style.cssText = `
                color: #28a745;
                font-size: 14px;
                font-weight: 500;
                margin: 20px 0 15px 0;
            `;


            const closeBtn = createElementWithText('button', '我知道了');
            closeBtn.style.cssText = `
                padding: 10px 25px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s ease;
            `;

            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = '#218838';
            });

            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = '#28a745';
            });

            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });

            modalContent.appendChild(closeBtnX);
            modalContent.appendChild(title);
            modalContent.appendChild(content);
            modalContent.appendChild(blessing);
            modalContent.appendChild(closeBtn);
            modal.appendChild(modalContent);

            return modal;
        };

        // 点击广告打开弹窗
        donationAd.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = createDonationModal();
            document.body.appendChild(modal);
        });

        // 组装搜索区域
        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(buttonContainer);
        table.parentNode.insertBefore(searchContainer, table);
        table.parentNode.insertBefore(donationAd, table);

        // 搜索框输入时也触发筛选
        searchInput.addEventListener('input', () => {
            filterTable(table, searchInput.value.trim().toLowerCase());
        });
    };

    // 筛选函数
    const filterTable = (table, keyword) => {
        const allRows = table.querySelectorAll('tr');

        let headerRow = table.querySelector('thead tr');
        if (!headerRow && allRows.length > 0) {
            headerRow = allRows[0];
        }

        const dataRows = [];
        allRows.forEach(row => {
            if (row !== headerRow) {
                dataRows.push(row);
            }
        });

        dataRows.forEach(row => {
            let isVisible = true;

            if (keyword) {
                isVisible = false;
                row.querySelectorAll('td').forEach(cell => {
                    if (cell.textContent.toLowerCase().includes(keyword)) {
                        isVisible = true;
                    }
                });
            }

            row.style.display = isVisible ? '' : 'none';
        });

        if (headerRow) {
            headerRow.style.display = '';
        }
    };

    // 安全启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

