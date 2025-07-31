// ==UserScript==
// @name         表格增强工具（筛选+排序）-自动触发版
// @namespace    http://tampermonkey.net/
// @version      1.9
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
        const notAppliedButton = createQuickFilterButton('未申请');
        const clearButton = createClearButton();

        // 添加按钮
        buttonContainer.appendChild(paidButton);
        buttonContainer.appendChild(appliedButton);
        buttonContainer.appendChild(notAppliedButton);
        buttonContainer.appendChild(clearButton);

        // 组装搜索区域
        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(buttonContainer);
        table.parentNode.insertBefore(searchContainer, table);

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
