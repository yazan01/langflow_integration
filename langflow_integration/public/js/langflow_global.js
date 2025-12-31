/**
 * Global Langflow Chat Widget Integration
 * Adds AI Chat Widget to all DocTypes (List & Form views)
 */

// Global function to create and embed chat widget
function create_langflow_widget(context_data) {
    // Remove existing widget if present
    $('#langflow-embedded-widget').remove();
    
    const doctype = context_data.doctype;
    const docname = context_data.docname || null;
    const is_list = context_data.is_list || false;
    
    // Prepare header title
    let header_title = '🤖 AI Assistant';
    let header_subtitle = '';
    
    if (is_list) {
        header_subtitle = `${doctype} List`;
    } else {
        header_subtitle = `${doctype}: ${docname}`;
    }
    
    // Create embedded chat widget
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
            <!-- Header -->
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
            
            <!-- Messages Container -->
            <div id="langflow-widget-messages" style="
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f8f9fa;
            "></div>
            
            <!-- Input Area -->
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
                           " 
                           onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                           onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'" />
                    <button id="langflow-widget-send" 
                            class="btn btn-primary"
                            style="
                                border-radius: 24px;
                                padding: 12px 24px;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                border: none;
                                font-weight: 600;
                                transition: all 0.2s;
                            "
                            onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.4)'"
                            onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">${__('إرسال')}</button>
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: #6c757d; text-align: center;">
                    ⚡ Powered by Langflow AI
                </div>
            </div>
        </div>
    `;
    
    // Append to body
    $('body').append(widget_html);
    
    // Generate session ID
    let session_id = frappe.utils.get_random(32);
    
    // Setup event handlers
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
    
    // Add welcome message
    setTimeout(function() {
        let welcome_msg = '';
        if (is_list) {
            welcome_msg = `مرحباً! 👋 أنا مساعد AI. يمكنني مساعدتك في الاستعلام عن بيانات ${doctype}. اسألني أي سؤال!`;
        } else {
            welcome_msg = `مرحباً! 👋 أنا مساعد AI. يمكنني مساعدتك في تحليل وفهم بيانات ${doctype}: ${docname}. كيف يمكنني مساعدتك؟`;
        }
        append_langflow_message('ai', welcome_msg);
    }, 300);
    
    // Show animation
    $('#langflow-embedded-widget').hide().fadeIn(400);
}

function send_langflow_message(context_data, session_id) {
    let $input = $('#langflow-widget-input');
    let message = $input.val().trim();
    if (!message) return;
    
    append_langflow_message('user', message);
    $input.val('');
    
    // Show typing indicator
    append_langflow_message('ai', '<div class="typing-indicator"><span></span><span></span><span></span></div>');
    
    // Prepare context message
    let context_message = '';
    
    if (context_data.is_list) {
        context_message = `DocType: ${context_data.doctype}
Context: List View
Question: ${message}

أريد الاستعلام عن بيانات ${context_data.doctype} في وضع العرض القائمة.`;
    } else {
        context_message = `DocType: ${context_data.doctype}
Document Name: ${context_data.docname}
Question: ${message}

أريد الاستعلام عن المستند ${context_data.docname} من نوع ${context_data.doctype}.`;
    }
    
    // Call Langflow API
    frappe.call({
        method: 'langflow_integration.langflow_integration.api.langflow_client.chat_with_langflow',
        args: {
            message: context_message,
            session_id: session_id
        },
        callback: function(r) {
            // Remove typing indicator
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
            // Remove typing indicator
            $('#langflow-widget-messages > div:last-child').remove();
            append_langflow_message('ai', `❌ ${__('فشل الاتصال بخدمة AI. يرجى التحقق من الاتصال.')}`);
        }
    });
}

function append_langflow_message(type, message) {
    let isUser = type === 'user';
    let alignClass = isUser ? 'flex-end' : 'flex-start';
    let bgColor = isUser ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff';
    let textColor = isUser ? '#fff' : '#333';
    let boxShadow = isUser ? 'none' : '0 2px 12px rgba(0,0,0,0.08)';
    
    let msg_html = `
        <div style="
            display: flex;
            justify-content: ${alignClass};
            margin-bottom: 16px;
            animation: slideIn 0.3s ease-out;
        ">
            <div style="
                background: ${bgColor};
                color: ${textColor};
                padding: 14px 18px;
                border-radius: ${isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px'};
                max-width: 80%;
                box-shadow: ${boxShadow};
                word-wrap: break-word;
                font-size: 14px;
                line-height: 1.6;
            ">
                ${message}
            </div>
        </div>
    `;
    
    let $messages = $('#langflow-widget-messages');
    $messages.append(msg_html);
    $messages.scrollTop($messages[0].scrollHeight);
}

function extract_langflow_response(data) {
    try {
        if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
            let output = data.outputs[0];
            
            if (output.outputs && Array.isArray(output.outputs) && output.outputs.length > 0) {
                let result = output.outputs[0];
                
                if (result.results) {
                    if (result.results.message) {
                        if (typeof result.results.message === 'string') {
                            return result.results.message;
                        }
                        if (result.results.message.text) {
                            return result.results.message.text;
                        }
                    }
                    if (result.results.text) {
                        return result.results.text;
                    }
                }
                
                if (result.message) {
                    if (typeof result.message === 'string') {
                        return result.message;
                    }
                    if (result.message.text) {
                        return result.message.text;
                    }
                }
            }
        }
        
        if (data.session_id) {
            let text = find_text_in_langflow_response(data);
            if (text) return text;
        }
        
        return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        
    } catch (e) {
        console.error('Error extracting Langflow response:', e);
        return `${__('تم استلام الرد ولكن لم يتم تحليله')}<br><pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

function find_text_in_langflow_response(obj, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return null;
    
    if (typeof obj === 'string' && obj.length > 10) {
        return obj;
    }
    
    if (typeof obj === 'object' && obj !== null) {
        const priority_fields = ['text', 'message', 'content', 'response', 'output', 'answer'];
        
        for (let field of priority_fields) {
            if (obj[field]) {
                if (typeof obj[field] === 'string') {
                    return obj[field];
                }
                let result = find_text_in_langflow_response(obj[field], depth + 1, maxDepth);
                if (result) return result;
            }
        }
        
        for (let key in obj) {
            if (priority_fields.includes(key)) continue;
            let result = find_text_in_langflow_response(obj[key], depth + 1, maxDepth);
            if (result) return result;
        }
    }
    
    return null;
}

// Add global styles for chat widget
if (!$('#langflow-global-styles').length) {
    $('head').append(`
        <style id="langflow-global-styles">
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .typing-indicator {
                display: flex;
                gap: 4px;
                padding: 8px 0;
            }
            
            .typing-indicator span {
                width: 8px;
                height: 8px;
                background: #667eea;
                border-radius: 50%;
                animation: typing 1.4s infinite;
            }
            
            .typing-indicator span:nth-child(2) {
                animation-delay: 0.2s;
            }
            
            .typing-indicator span:nth-child(3) {
                animation-delay: 0.4s;
            }
            
            @keyframes typing {
                0%, 60%, 100% {
                    transform: translateY(0);
                    opacity: 0.7;
                }
                30% {
                    transform: translateY(-10px);
                    opacity: 1;
                }
            }
            
            #langflow-widget-messages::-webkit-scrollbar {
                width: 6px;
            }
            
            #langflow-widget-messages::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }
            
            #langflow-widget-messages::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 3px;
            }
            
            #langflow-widget-messages::-webkit-scrollbar-thumb:hover {
                background: #667eea;
            }
        </style>
    `);
}

// Make the function globally available
window.create_langflow_widget = create_langflow_widget;

// ==============================================
// FORM VIEW Integration - Multiple Methods
// ==============================================

// Method 1: Using frappe.ui.form.on with wildcard
frappe.ui.form.on('*', {
    refresh: function(frm) {
        add_langflow_button_to_form(frm);
    },
    onload: function(frm) {
        add_langflow_button_to_form(frm);
    }
});

// Method 2: Hook into after_load
$(document).on('form-load form-refresh', function() {
    if (cur_frm && !cur_frm.is_new()) {
        add_langflow_button_to_form(cur_frm);
    }
});

// Method 3: Watch for page changes
frappe.router.on('change', function() {
    setTimeout(function() {
        if (cur_frm && !cur_frm.is_new()) {
            add_langflow_button_to_form(cur_frm);
        }
    }, 500);
});

// Method 4: Using frappe.after_ajax
$(document).ajaxComplete(function() {
    if (cur_frm && !cur_frm.is_new()) {
        setTimeout(function() {
            add_langflow_button_to_form(cur_frm);
        }, 300);
    }
});

function add_langflow_button_to_form(frm) {
    if (!frm || frm.is_new()) {
        return;
    }
    
    // Check if button already exists
    const button_label = __('AI Chat Widget');
    const group_label = __('🤖 Langflow');
    
    // Remove existing button if present to avoid duplicates
    if (frm.custom_buttons && frm.custom_buttons[group_label]) {
        const existing = frm.custom_buttons[group_label].find(btn => {
            return $(btn).text().trim() === button_label;
        });
        
        if (existing && existing.length > 0) {
            console.log(`ℹ️ Langflow: Button already exists in ${frm.doctype} form`);
            return;
        }
    }
    
    try {
        // Add the button
        frm.add_custom_button(button_label, function() {
            create_langflow_widget({
                doctype: frm.doctype,
                docname: frm.docname,
                is_list: false
            });
        }, group_label);
        
        console.log(`✅ Langflow: Button added to ${frm.doctype} form (${frm.docname})`);
    } catch (e) {
        console.error('❌ Langflow: Error adding button to form:', e);
    }
}

// ==============================================
// LIST VIEW Integration
// ==============================================

// Method 1: Using frappe.listview_settings
frappe.listview_settings['*'] = {
    onload: function(listview) {
        add_langflow_button_to_list(listview);
    },
    refresh: function(listview) {
        add_langflow_button_to_list(listview);
    }
};

// Method 2: Hook into list page load
$(document).on('list-load list-refresh', function() {
    if (cur_list) {
        add_langflow_button_to_list(cur_list);
    }
});

// Method 3: Watch for route changes
frappe.router.on('change', function() {
    setTimeout(function() {
        if (cur_list) {
            add_langflow_button_to_list(cur_list);
        }
    }, 800);
});

// Method 4: Periodic check (fallback)
setInterval(function() {
    if (cur_list && window.location.pathname.includes('/list')) {
        add_langflow_button_to_list(cur_list);
    }
}, 3000);

function add_langflow_button_to_list(listview) {
    if (!listview || !listview.page) {
        return;
    }
    
    const button_label = __('AI Chat Widget');
    const group_label = __('🤖 Langflow');
    
    // Check if button already exists
    const existing_button = listview.page.inner_toolbar && 
                           listview.page.inner_toolbar.find(`.btn:contains("${button_label}")`);
    
    if (existing_button && existing_button.length > 0) {
        console.log(`ℹ️ Langflow: Button already exists in ${listview.doctype} list`);
        return;
    }
    
    try {
        if (listview.page.add_inner_button) {
            listview.page.add_inner_button(button_label, function() {
                create_langflow_widget({
                    doctype: listview.doctype,
                    docname: null,
                    is_list: true
                });
            }, group_label);
            
            console.log(`✅ Langflow: Button added to ${listview.doctype} list`);
        }
    } catch (e) {
        console.error('❌ Langflow: Error adding button to list:', e);
    }
}

// ==============================================
// Initialize on document ready
// ==============================================
$(document).ready(function() {
    console.log('✅ Langflow Global Integration Loaded Successfully');
    
    // Initial check after short delay
    setTimeout(function() {
        // Check form
        if (cur_frm && !cur_frm.is_new()) {
            add_langflow_button_to_form(cur_frm);
        }
        
        // Check list
        if (cur_list) {
            add_langflow_button_to_list(cur_list);
        }
    }, 1000);
});
