/**
 * Langflow Global Integration - DIRECT SOLUTION
 * This version uses the most reliable method to add buttons
 */

// Global function to create chat widget
function create_langflow_widget(context_data) {
    $('#langflow-embedded-widget').remove();
    
    const doctype = context_data.doctype;
    const docname = context_data.docname || null;
    const is_list = context_data.is_list || false;
    
    let header_title = '🤖 AI Assistant';
    let header_subtitle = is_list ? `${doctype} List` : `${doctype}: ${docname}`;
    
    let widget_html = `
        <div id="langflow-embedded-widget" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 400px;
            height: 650px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            display: flex;
            flex-direction: column;
            z-index: 1050;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 18px 20px;
                border-radius: 16px 16px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 17px; margin-bottom: 4px;">${header_title}</div>
                    <div style="font-size: 12px; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${header_subtitle}">${header_subtitle}</div>
                </div>
                <button id="langflow-close-widget" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 24px;
                    line-height: 1;
                    transition: all 0.2s;
                    flex-shrink: 0;
                    margin-left: 12px;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.1)'"
                   onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)'">×</button>
            </div>
            
            <div id="langflow-widget-messages" style="
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f8f9fa;
            "></div>
            
            <div style="
                padding: 16px;
                border-top: 1px solid #e9ecef;
                background: white;
                border-radius: 0 0 16px 16px;
            ">
                <div style="display: flex; gap: 10px;">
                    <input type="text" 
                           id="langflow-widget-input" 
                           class="form-control" 
                           placeholder="${__('اكتب رسالتك...')}"
                           style="
                               flex: 1;
                               border: 1px solid #dee2e6;
                               border-radius: 24px;
                               padding: 12px 18px;
                               font-size: 14px;
                               transition: all 0.2s;
                           " />
                    <button id="langflow-widget-send" 
                            class="btn btn-primary"
                            style="
                                border-radius: 24px;
                                padding: 12px 24px;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                border: none;
                                font-weight: 600;
                            ">${__('إرسال')}</button>
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: #6c757d; text-align: center;">
                    ⚡ Powered by Langflow AI
                </div>
            </div>
        </div>
    `;
    
    $('body').append(widget_html);
    
    let session_id = frappe.utils.get_random(32);
    
    $('#langflow-close-widget').on('click', function() {
        $('#langflow-embedded-widget').fadeOut(300, function() {
            $(this).remove();
        });
    });
    
    $('#langflow-widget-send').on('click', function() {
        send_langflow_message(context_data, session_id);
    });
    
    $('#langflow-widget-input').on('keypress', function(e) {
        if (e.which === 13) {
            send_langflow_message(context_data, session_id);
        }
    });
    
    setTimeout(function() {
        let welcome_msg = is_list 
            ? `مرحباً! 👋 أنا مساعد AI. يمكنني مساعدتك في الاستعلام عن بيانات ${doctype}. اسألني أي سؤال!`
            : `مرحباً! 👋 أنا مساعد AI. يمكنني مساعدتك في تحليل وفهم بيانات ${doctype}: ${docname}. كيف يمكنني مساعدتك؟`;
        append_langflow_message('ai', welcome_msg);
    }, 300);
    
    $('#langflow-embedded-widget').hide().fadeIn(400);
}

function send_langflow_message(context_data, session_id) {
    let $input = $('#langflow-widget-input');
    let message = $input.val().trim();
    if (!message) return;
    
    append_langflow_message('user', message);
    $input.val('');
    append_langflow_message('ai', '<div class="typing-indicator"><span></span><span></span><span></span></div>');
    
    let context_message = context_data.is_list
        ? `DocType: ${context_data.doctype}\nContext: List View\nQuestion: ${message}\n\nأريد الاستعلام عن بيانات ${context_data.doctype} في وضع العرض القائمة.`
        : `DocType: ${context_data.doctype}\nDocument Name: ${context_data.docname}\nQuestion: ${message}\n\nأريد الاستعلام عن المستند ${context_data.docname} من نوع ${context_data.doctype}.`;
    
    frappe.call({
        method: 'langflow_integration.langflow_integration.api.langflow_client.chat_with_langflow',
        args: {
            message: context_message,
            session_id: session_id
        },
        callback: function(r) {
            $('#langflow-widget-messages > div:last-child').remove();
            if (r.message && r.message.success) {
                let response = extract_langflow_response(r.message.data);
                append_langflow_message('ai', response);
            } else {
                let error_msg = r.message && r.message.error ? r.message.error : __('حدث خطأ غير معروف');
                append_langflow_message('ai', `❌ ${__('عذراً، واجهت خطأ')}: ${error_msg}`);
            }
        },
        error: function(r) {
            $('#langflow-widget-messages > div:last-child').remove();
            append_langflow_message('ai', `❌ ${__('فشل الاتصال بخدمة AI.')}`);
        }
    });
}

function append_langflow_message(type, message) {
    let isUser = type === 'user';
    let msg_html = `
        <div style="display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'}; margin-bottom: 16px;">
            <div style="
                background: ${isUser ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff'};
                color: ${isUser ? '#fff' : '#333'};
                padding: 14px 18px;
                border-radius: ${isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px'};
                max-width: 80%;
                box-shadow: ${isUser ? 'none' : '0 2px 12px rgba(0,0,0,0.08)'};
                word-wrap: break-word;
                font-size: 14px;
                line-height: 1.6;
            ">${message}</div>
        </div>
    `;
    $('#langflow-widget-messages').append(msg_html).scrollTop($('#langflow-widget-messages')[0].scrollHeight);
}

function extract_langflow_response(data) {
    try {
        if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
            let output = data.outputs[0];
            if (output.outputs && Array.isArray(output.outputs) && output.outputs.length > 0) {
                let result = output.outputs[0];
                if (result.results) {
                    if (result.results.message) {
                        if (typeof result.results.message === 'string') return result.results.message;
                        if (result.results.message.text) return result.results.message.text;
                    }
                    if (result.results.text) return result.results.text;
                }
                if (result.message) {
                    if (typeof result.message === 'string') return result.message;
                    if (result.message.text) return result.message.text;
                }
            }
        }
        return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    } catch (e) {
        return `${__('تم استلام الرد ولكن لم يتم تحليله')}<br><pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

// Add styles
if (!$('#langflow-global-styles').length) {
    $('head').append(`
        <style id="langflow-global-styles">
            .typing-indicator { display: flex; gap: 4px; padding: 8px 0; }
            .typing-indicator span {
                width: 8px; height: 8px;
                background: #667eea;
                border-radius: 50%;
                animation: typing 1.4s infinite;
            }
            .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typing {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
                30% { transform: translateY(-10px); opacity: 1; }
            }
        </style>
    `);
}

window.create_langflow_widget = create_langflow_widget;

// ============================================
// DIRECT BUTTON INJECTION - MOST RELIABLE
// ============================================

function inject_langflow_button_to_current_page() {
    // For FORM View
    if (cur_frm && !cur_frm.is_new()) {
        // Check if button group exists
        if (!cur_frm.page.btn_group) {
            console.log('⚠️ Langflow: Button group not ready yet');
            return;
        }
        
        // Check if already added
        const existing = cur_frm.page.btn_group.find('.btn-langflow-chat');
        if (existing.length > 0) {
            return; // Already added
        }
        
        // Create button HTML directly
        const btn_html = `
            <button class="btn btn-default btn-sm ellipsis btn-langflow-chat" 
                    data-label="AI Chat Widget"
                    style="margin-right: 8px;">
                <span class="btn-label">🤖 AI Chat Widget</span>
            </button>
        `;
        
        // Inject button
        cur_frm.page.btn_group.prepend(btn_html);
        
        // Attach click event
        cur_frm.page.btn_group.find('.btn-langflow-chat').on('click', function() {
            create_langflow_widget({
                doctype: cur_frm.doctype,
                docname: cur_frm.docname,
                is_list: false
            });
        });
        
        console.log(`✅ Langflow: Button injected to ${cur_frm.doctype} form`);
    }
    
    // For LIST View
    if (cur_list && cur_list.page) {
        const existing = cur_list.page.inner_toolbar.find('.btn-langflow-chat');
        if (existing.length > 0) {
            return; // Already added
        }
        
        const btn_html = `
            <button class="btn btn-default btn-sm btn-langflow-chat" 
                    style="margin-left: 10px;">
                <span>🤖 AI Chat Widget</span>
            </button>
        `;
        
        cur_list.page.inner_toolbar.append(btn_html);
        
        cur_list.page.inner_toolbar.find('.btn-langflow-chat').on('click', function() {
            create_langflow_widget({
                doctype: cur_list.doctype,
                docname: null,
                is_list: true
            });
        });
        
        console.log(`✅ Langflow: Button injected to ${cur_list.doctype} list`);
    }
}

// ============================================
// MULTIPLE TRIGGERS
// ============================================

// Trigger 1: Immediate check
$(document).ready(function() {
    console.log('✅ Langflow Global Integration Loaded Successfully');
    setTimeout(inject_langflow_button_to_current_page, 500);
    setTimeout(inject_langflow_button_to_current_page, 1500);
    setTimeout(inject_langflow_button_to_current_page, 3000);
});

// Trigger 2: Route changes
frappe.router.on('change', function() {
    setTimeout(inject_langflow_button_to_current_page, 500);
    setTimeout(inject_langflow_button_to_current_page, 1000);
});

// Trigger 3: Page show events
$(document).on('page-change', function() {
    setTimeout(inject_langflow_button_to_current_page, 300);
});

// Trigger 4: Form events
$(document).on('form-load form-refresh', function() {
    setTimeout(inject_langflow_button_to_current_page, 200);
});

// Trigger 5: Periodic check (every 3 seconds for first minute)
let check_count = 0;
const periodic_check = setInterval(function() {
    inject_langflow_button_to_current_page();
    check_count++;
    if (check_count > 20) {
        clearInterval(periodic_check);
    }
}, 3000);

// Trigger 6: MutationObserver for btn_group
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
            setTimeout(inject_langflow_button_to_current_page, 100);
        }
    });
});

// Start observing when document is ready
$(document).ready(function() {
    setTimeout(function() {
        if (cur_frm && cur_frm.page && cur_frm.page.btn_group) {
            observer.observe(cur_frm.page.btn_group[0], {
                childList: true,
                subtree: true
            });
        }
    }, 1000);
});

console.log('🚀 Langflow: Multiple injection triggers activated');
