frappe.ui.form.on('Job Applicant', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            // Add AI Analysis button
            frm.add_custom_button(__('AI Analysis'), function() {
                analyze_job_applicant_with_ai(frm);
            }, __('Langflow'));
            
            // Add Chat button
            frm.add_custom_button(__('Chat with AI'), function() {
                open_ai_chat(frm);
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
                default: 'قم بتحليل بيانات هذا العميل وقدم توصيات لتحسين العلاقة معه',
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

function open_ai_chat(frm) {
    let chat_dialog = new frappe.ui.Dialog({
        title: __('AI Assistant'),
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'chat_area'
            }
        ],
        size: 'large'
    });
    
    let chat_html = `
        <div id="langflow-chat-container" style="height: 400px; overflow-y: auto; border: 1px solid #d1d8dd; border-radius: 4px; padding: 10px; margin-bottom: 10px;">
            <div id="langflow-messages"></div>
        </div>
        <div style="display: flex; gap: 10px;">
            <input type="text" id="langflow-message-input" class="form-control" placeholder="${__('Type your message...')}" />
            <button id="langflow-send-btn" class="btn btn-primary">${__('Send')}</button>
        </div>
    `;
    
    chat_dialog.fields_dict.chat_area.$wrapper.html(chat_html);
    
    let session_id = frappe.utils.get_random(32);
    
    $('#langflow-send-btn').on('click', function() {
        send_chat_message(frm, session_id);
    });
    
    $('#langflow-message-input').on('keypress', function(e) {
        if (e.which === 13) {
            send_chat_message(frm, session_id);
        }
    });
    
    chat_dialog.show();
    
    // Wait for dialog to render before adding welcome message
    setTimeout(function() {
        append_chat_message('ai', `مرحباً! أنا مساعد AI للمرشحين. كيف يمكنني مساعدتك بخصوص المرشح ${frm.doc.applicant_name}؟`);
    }, 100);
}

function send_chat_message(frm, session_id) {
    let message = $('#langflow-message-input').val().trim();
    if (!message) return;
    
    append_chat_message('user', message);
    $('#langflow-message-input').val('');
    
    // Add context about the current applicant
    let context_message = `المرشح: ${frm.doc.applicant_name}\nالسؤال: ${message}`;
    
    frappe.call({
        method: 'langflow_integration.langflow_integration.api.langflow_client.chat_with_langflow',
        args: {
            message: context_message,
            session_id: session_id
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                let response = extract_ai_response(r.message.data);
                append_chat_message('ai', response);
            } else {
                append_chat_message('ai', __('Sorry, I encountered an error. Please try again.'));
            }
        }
    });
}

function append_chat_message(type, message) {
    let msg_class = type === 'user' ? 'text-right' : 'text-left';
    let bg_class = type === 'user' ? 'bg-primary text-white' : 'bg-light';
    
    let msg_html = `
        <div class="${msg_class}" style="margin-bottom: 10px;">
            <div class="${bg_class}" style="display: inline-block; padding: 8px 12px; border-radius: 8px; max-width: 70%;">
                ${message}
            </div>
        </div>
    `;
    
    let $messages = $('#langflow-messages');
    let $container = $('#langflow-chat-container');
    
    // Check if elements exist before trying to manipulate them
    if ($messages.length && $container.length) {
        $messages.append(msg_html);
        $container.scrollTop($container[0].scrollHeight);
    }
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
        // Try different paths to extract the response
        if (data.outputs && data.outputs[0]) {
            let output = data.outputs[0];
            if (output.outputs && output.outputs[0]) {
                let result = output.outputs[0];
                if (result.results && result.results.message) {
                    return result.results.message.text || result.results.message;
                }
            }
        }
        
        // Fallback: return JSON
        return JSON.stringify(data, null, 2);
    } catch (e) {
        console.error('Error extracting AI response:', e);
        return __('Response received but could not be parsed');
    }
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
