/**
 * Langflow Global Integration - IMPROVED SOLUTION
 * Fixed: Button not appearing in Form View
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
// IMPROVED BUTTON INJECTION FOR FORM VIEW
// ============================================

function inject_langflow_button_to_form() {
    if (!cur_frm || cur_frm.is_new()) {
        return;
    }
    
    // Check if already added
    if (cur_frm._langflow_button_added) {
        return;
    }
    
    try {
        // Method 1: Using add_custom_button (Most Reliable)
        cur_frm.add_custom_button(__('🤖 AI Chat Widget'), function() {
            create_langflow_widget({
                doctype: cur_frm.doctype,
                docname: cur_frm.docname,
                is_list: false
            });
        });
        
        cur_frm._langflow_button_added = true;
        console.log(`✅ Langflow: Button added to ${cur_frm.doctype} form`);
        
    } catch (e) {
        console.error('❌ Langflow Form Button Error:', e);
    }
}

function inject_langflow_button_to_list() {
    if (!cur_list || !cur_list.page) {
        return;
    }
    
    // Check if already added
    const existing = cur_list.page.inner_toolbar.find('.btn-langflow-chat');
    if (existing.length > 0) {
        return;
    }
    
    try {
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
        
        console.log(`✅ Langflow: Button added to ${cur_list.doctype} list`);
        
    } catch (e) {
        console.error('❌ Langflow List Button Error:', e);
    }
}

// Main injection function
function inject_langflow_buttons() {
    inject_langflow_button_to_form();
    inject_langflow_button_to_list();
}

// ============================================
// EVENT LISTENERS - COMPREHENSIVE TRIGGERS
// ============================================

// Trigger 1: Document Ready
$(document).ready(function() {
    console.log('✅ Langflow Global Integration Loaded');
    setTimeout(inject_langflow_buttons, 500);
    setTimeout(inject_langflow_buttons, 1500);
});

// Trigger 2: Frappe Ready
frappe.ready(function() {
    setTimeout(inject_langflow_buttons, 300);
});

// Trigger 3: Route Changes
frappe.router.on('change', function() {
    // Clear the flag when route changes
    if (cur_frm) {
        cur_frm._langflow_button_added = false;
    }
    setTimeout(inject_langflow_buttons, 500);
    setTimeout(inject_langflow_buttons, 1000);
});

// Trigger 4: Form-specific events
frappe.ui.form.on('*', {
    refresh: function(frm) {
        setTimeout(inject_langflow_button_to_form, 200);
    },
    onload: function(frm) {
        setTimeout(inject_langflow_button_to_form, 300);
    }
});

// Trigger 5: DOM mutation observer for form toolbar
function setup_form_observer() {
    const observer = new MutationObserver(function(mutations) {
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                setTimeout(inject_langflow_button_to_form, 100);
            }
        }
    });
    
    // Observe the page element
    if (cur_frm && cur_frm.page && cur_frm.page.wrapper) {
        observer.observe(cur_frm.page.wrapper[0], {
            childList: true,
            subtree: true
        });
    }
}

// Setup observer when form loads
$(document).on('form-load', function() {
    setTimeout(setup_form_observer, 500);
    setTimeout(inject_langflow_button_to_form, 300);
});

// Trigger 6: Periodic check (first 30 seconds only)
let check_count = 0;
const periodic_check = setInterval(function() {
    inject_langflow_buttons();
    check_count++;
    if (check_count > 10) {
        clearInterval(periodic_check);
    }
}, 3000);

console.log('🚀 Langflow: All injection triggers activated');
