frappe.ui.form.on('Customer', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            // Add AI Analysis button
            frm.add_custom_button(__('AI Analysis'), function() {
                analyze_customer_with_ai(frm);
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

function analyze_customer_with_ai(frm) {
    let d = new frappe.ui.Dialog({
        title: __('AI Customer Analysis'),
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
                        show_ai_response(r.message.data, 'Customer Analysis');
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
    
    // Show typing indicator
    append_chat_message('ai', '<em>جاري الكتابة...</em>');
    
    // Add context about the current applicant
    let context_message = `المرشح: ${frm.doc.applicant_name}\nالسؤال: ${message}`;
    
    frappe.call({
        method: 'langflow_integration.langflow_integration.api.langflow_client.chat_with_langflow',
        args: {
            message: context_message,
            session_id: session_id
        },
        callback: function(r) {
            // Remove typing indicator
            $('#langflow-messages > div:last-child').remove();
            
            console.log('Chat Response:', r.message); // Debug log
            
            if (r.message && r.message.success) {
                let response = extract_ai_response(r.message.data);
                append_chat_message('ai', response);
            } else {
                let error_msg = r.message && r.message.error ? r.message.error : __('Unknown error occurred');
                append_chat_message('ai', `❌ ${__('Sorry, I encountered an error')}: ${error_msg}`);
            }
        },
        error: function(r) {
            // Remove typing indicator
            $('#langflow-messages > div:last-child').remove();
            console.error('Chat Error:', r);
            append_chat_message('ai', `❌ ${__('Failed to connect to AI service. Please check your connection.')}`);
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
        console.log('Extracting from data:', data); // Debug log
        
        // Method 1: Check outputs array
        if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
            let output = data.outputs[0];
            
            // Check nested outputs
            if (output.outputs && Array.isArray(output.outputs) && output.outputs.length > 0) {
                let result = output.outputs[0];
                
                // Check for message in results
                if (result.results) {
                    if (result.results.message) {
                        if (typeof result.results.message === 'string') {
                            return result.results.message;
                        }
                        if (result.results.message.text) {
                            return result.results.message.text;
                        }
                    }
                    // Check for text field directly in results
                    if (result.results.text) {
                        return result.results.text;
                    }
                }
                
                // Check for message at result level
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
        
        // Method 2: Check session_id response
        if (data.session_id) {
            // Look for any text fields in the data
            let text = find_text_in_object(data);
            if (text) return text;
        }
        
        // Fallback: return formatted JSON
        return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        
    } catch (e) {
        console.error('Error extracting AI response:', e);
        return `${__('Response received but could not be parsed')}<br><pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

// Helper function to recursively search for text responses
function find_text_in_object(obj, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return null;
    
    if (typeof obj === 'string' && obj.length > 10) {
        return obj;
    }
    
    if (typeof obj === 'object' && obj !== null) {
        // Priority fields to check
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
        
        // Check all other fields
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
