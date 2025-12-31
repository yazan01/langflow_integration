frappe.ui.form.on('Job Applicant', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            // Add AI Analysis button
            frm.add_custom_button(__('AI Analysis'), function() {
                analyze_job_applicant_with_ai(frm);
            }, __('Langflow'));
            
            // Add Embedded Chat Widget button
            frm.add_custom_button(__('Embed Chat Widget'), function() {
                embed_chat_widget(frm);
            }, __('Langflow'));
            
            // Add Test Connection button (for admins)
            if (frappe.user.has_role('System Manager')) {
                frm.add_custom_button(__('Test Connection'), function() {
                    test_langflow_connection();
                }, __('Langflow'));
            }
        }
    }
});

function analyze_job_applicant_with_ai(frm) {
    let d = new frappe.ui.Dialog({
        title: __('AI Job Applicant Analysis'),
        fields: [
            {
                label: __('Analysis Prompt'),
                fieldname: 'prompt',
                fieldtype: 'Small Text',
                default: 'قم بتحليل بيانات هذا المرشح وقدم تقييماً شاملاً لمؤهلاته ومدى ملاءمته للوظيفة',
                reqd: 1
            }
        ],
        primary_action_label: __('Analyze'),
        primary_action(values) {
            d.hide();
            frappe.show_alert({
                message: __('Processing...'),
                indicator: 'blue'
            });
            
            frappe.call({
                method: 'langflow_integration.langflow_integration.api.langflow_client.process_document_with_ai',
                args: {
                    doctype: frm.doctype,
                    docname: frm.docname,
                    prompt: values.prompt
                },
                callback: function(r) {
                    if (r.message && r.message.success) {
                        show_ai_response(r.message.data, 'Job Applicant Analysis');
                    } else {
                        frappe.msgprint({
                            title: __('Error'),
                            message: r.message ? r.message.error : __('Unknown error occurred'),
                            indicator: 'red'
                        });
                    }
                },
                error: function(r) {
                    frappe.msgprint({
                        title: __('Error'),
                        message: __('Failed to connect to AI service'),
                        indicator: 'red'
                    });
                }
            });
        }
    });
    
    d.show();
}

// Embedded Chat Widget - Adds a persistent chat interface to the page
function embed_chat_widget(frm) {
    // Remove existing widget if present
    $('#langflow-embedded-widget').remove();
    
    // Create embedded chat widget
    let widget_html = `
        <div id="langflow-embedded-widget" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 380px;
            height: 600px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            z-index: 1050;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
            <!-- Header -->
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 20px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div>
                    <div style="font-weight: 600; font-size: 16px;">🤖 AI Recruitment Assistant</div>
                    <div style="font-size: 12px; opacity: 0.9;">Applicant: ${frm.doc.applicant_name || frm.doc.name}</div>
                </div>
                <button id="langflow-close-widget" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 20px;
                    line-height: 1;
                    transition: background 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                   onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
            </div>
            
            <!-- Messages Container -->
            <div id="langflow-widget-messages" style="
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                background: #f8f9fa;
            "></div>
            
            <!-- Input Area -->
            <div style="
                padding: 16px;
                border-top: 1px solid #e9ecef;
                background: white;
                border-radius: 0 0 12px 12px;
            ">
                <div style="display: flex; gap: 8px;">
                    <input type="text" 
                           id="langflow-widget-input" 
                           class="form-control" 
                           placeholder="${__('Type your message...')}"
                           style="
                               flex: 1;
                               border: 1px solid #dee2e6;
                               border-radius: 20px;
                               padding: 10px 16px;
                               font-size: 14px;
                           " />
                    <button id="langflow-widget-send" 
                            class="btn btn-primary"
                            style="
                                border-radius: 20px;
                                padding: 10px 20px;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                border: none;
                                font-weight: 600;
                            ">${__('Send')}</button>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #6c757d; text-align: center;">
                    Powered by Langflow AI
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
        send_widget_message(frm, session_id);
    });
    
    $('#langflow-widget-input').on('keypress', function(e) {
        if (e.which === 13) {
            send_widget_message(frm, session_id);
        }
    });
    
    // Add welcome message
    setTimeout(function() {
        append_widget_message('ai', `مرحباً! 👋 أنا مساعد AI للتوظيف. كيف يمكنني مساعدتك بخصوص المرشح ${frm.doc.applicant_name || frm.doc.name}؟`);
    }, 300);
    
    // Show animation
    $('#langflow-embedded-widget').hide().fadeIn(300);
}

function send_widget_message(frm, session_id) {
    let $input = $('#langflow-widget-input');
    let message = $input.val().trim();
    if (!message) return;
    
    append_widget_message('user', message);
    $input.val('');
    
    // Show typing indicator
    append_widget_message('ai', '<div class="typing-indicator"><span></span><span></span><span></span></div>');
    
    // Add context about the current applicant
    let context_message = `المرشح: ${frm.doc.applicant_name || frm.doc.name}\nالسؤال: ${message}`;
    
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
                let response = extract_ai_response(r.message.data);
                append_widget_message('ai', response);
            } else {
                let error_msg = r.message && r.message.error ? r.message.error : __('Unknown error occurred');
                append_widget_message('ai', `❌ ${__('Sorry, I encountered an error')}: ${error_msg}`);
            }
        },
        error: function(r) {
            // Remove typing indicator
            $('#langflow-widget-messages > div:last-child').remove();
            append_widget_message('ai', `❌ ${__('Failed to connect to AI service. Please check your connection.')}`);
        }
    });
}

function append_widget_message(type, message) {
    let isUser = type === 'user';
    let alignClass = isUser ? 'flex-end' : 'flex-start';
    let bgColor = isUser ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff';
    let textColor = isUser ? '#fff' : '#333';
    let boxShadow = isUser ? 'none' : '0 2px 8px rgba(0,0,0,0.08)';
    
    let msg_html = `
        <div style="
            display: flex;
            justify-content: ${alignClass};
            margin-bottom: 12px;
            animation: slideIn 0.3s ease-out;
        ">
            <div style="
                background: ${bgColor};
                color: ${textColor};
                padding: 12px 16px;
                border-radius: ${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
                max-width: 75%;
                box-shadow: ${boxShadow};
                word-wrap: break-word;
                font-size: 14px;
                line-height: 1.5;
            ">
                ${message}
            </div>
        </div>
    `;
    
    let $messages = $('#langflow-widget-messages');
    $messages.append(msg_html);
    $messages.scrollTop($messages[0].scrollHeight);
}

function show_ai_response(data, title) {
    let response_text = extract_ai_response(data);
    
    let response_dialog = new frappe.ui.Dialog({
        title: __(title),
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'response_area'
            }
        ],
        size: 'large'
    });
    
    let formatted_html = `
        <div style="padding: 15px; background-color: #f9fafb; border-radius: 8px; white-space: pre-wrap;">
            ${response_text}
        </div>
    `;
    
    response_dialog.fields_dict.response_area.$wrapper.html(formatted_html);
    response_dialog.show();
}

function extract_ai_response(data) {
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
            let text = find_text_in_object(data);
            if (text) return text;
        }
        
        return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        
    } catch (e) {
        console.error('Error extracting AI response:', e);
        return `${__('Response received but could not be parsed')}<br><pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

function find_text_in_object(obj, depth = 0, maxDepth = 10) {
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
                let result = find_text_in_object(obj[field], depth + 1, maxDepth);
                if (result) return result;
            }
        }
        
        for (let key in obj) {
            if (priority_fields.includes(key)) continue;
            let result = find_text_in_object(obj[key], depth + 1, maxDepth);
            if (result) return result;
        }
    }
    
    return null;
}

function test_langflow_connection() {
    frappe.show_alert({
        message: __('Testing connection...'),
        indicator: 'blue'
    });
    
    frappe.call({
        method: 'langflow_integration.langflow_integration.api.langflow_client.test_connection',
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.msgprint({
                    title: __('Connection Successful'),
                    message: `${r.message.message}<br><br>URL: ${r.message.url}`,
                    indicator: 'green'
                });
            } else {
                frappe.msgprint({
                    title: __('Connection Failed'),
                    message: r.message ? r.message.error : __('Unknown error'),
                    indicator: 'red'
                });
            }
        }
    });
}

// Add CSS for typing indicator animation
if (!$('#langflow-widget-styles').length) {
    $('head').append(`
        <style id="langflow-widget-styles">
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
            }
            
            #langflow-widget-messages::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 3px;
            }
            
            #langflow-widget-messages::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
        </style>
    `);
}
