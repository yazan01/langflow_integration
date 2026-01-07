frappe.ui.form.on('Job Applicant', {
    onload: function(frm) {
        if (!frm.is_new()) {
            add_ai_extract_button(frm);
        }
    },
    refresh: function(frm) {
        if (!frm.is_new()) {
            add_ai_extract_button(frm);
        }
    }
});

function add_ai_extract_button(frm) {
    frm.add_custom_button(__('AI Extract CV'), function() {
        extract_cv_with_ai(frm);
    }).css({
        'background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'color': 'white',
        'border': 'none',
        'font-weight': '600'
    });
}

function extract_cv_with_ai(frm) {
    // التحقق من وجود CV مرفق
    if (!frm.doc.resume_attachment) {
        frappe.msgprint({
            title: __('No CV Attached'),
            indicator: 'red',
            message: __('Please attach a CV/Resume file first')
        });
        return;
    }

    let file_url = frm.doc.resume_attachment;
    console.log('📄 CV File URL:', file_url);

    // عرض مؤشر التحميل
    frappe.show_alert({
        message: __('Extracting CV data with AI...'),
        indicator: 'blue'
    }, 3);

    // استدعاء API المخصص لاستخراج CV
    // لا نحتاج لتمرير flow_id - سيتم الحصول عليه من site_config.json تلقائياً
    frappe.call({
        method: 'langflow_integration.langflow_integration.api.langflow_client.extract_cv_data',
        args: {
            applicant_name: frm.doc.name,
            cv_file_url: file_url
            // flow_id ليس مطلوباً - سيتم الحصول عليه من الإعدادات
        },
        freeze: true,
        freeze_message: __('AI is processing your CV...'),
        callback: function(r) {
            console.log('📥 Full Response:', r);
            
            if (r.message && r.message.success) {
                console.log('✅ Success! Data:', r.message.data);
                frappe.show_alert({
                    message: __('CV extracted successfully!'),
                    indicator: 'green'
                }, 5);

                show_cv_extraction_results(r.message.data, frm);
            } else {
                let error_msg = (r.message && r.message.error) ? r.message.error : __('Unknown error occurred');
                console.error('❌ Extraction failed:', error_msg);
                frappe.msgprint({
                    title: __('Extraction Failed'),
                    indicator: 'red',
                    message: error_msg
                });
            }
        },
        error: function(r) {
            console.error('❌ API Error:', r);
            let error_detail = 'Failed to connect to AI service.';
            
            if (r.exception) {
                error_detail += '<br><br><pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 11px; max-height: 200px; overflow: auto;">' + 
                               frappe.utils.escape_html(r.exception) + '</pre>';
            }
            
            frappe.msgprint({
                title: __('Error'),
                indicator: 'red',
                message: error_detail
            });
        }
    });
}

function show_cv_extraction_results(data, frm) {
    console.log('🎨 Formatting results...', data);
    
    // استخراج النص من response
    let extracted_text = '';
    let extracted_data = null;
    
    try {
        if (data.outputs && data.outputs[0]) {
            let output = data.outputs[0];
            if (output.outputs && output.outputs[0]) {
                let result = output.outputs[0];
                
                // Try to get the message
                if (result.results && result.results.message) {
                    extracted_text = typeof result.results.message === 'string' 
                        ? result.results.message 
                        : result.results.message.text || JSON.stringify(result.results.message, null, 2);
                } else if (result.message) {
                    extracted_text = typeof result.message === 'string'
                        ? result.message
                        : result.message.text || JSON.stringify(result.message, null, 2);
                } else if (result.results && result.results.text) {
                    extracted_text = result.results.text;
                } else if (result.text) {
                    extracted_text = result.text;
                }
            }
        }
        
        if (!extracted_text) {
            extracted_text = JSON.stringify(data, null, 2);
        }
        
        // Try to parse as JSON for structured display
        try {
            extracted_data = JSON.parse(extracted_text);
        } catch (e) {
            // Not JSON, that's fine
        }
        
    } catch (e) {
        console.error('Error parsing results:', e);
        extracted_text = JSON.stringify(data, null, 2);
    }

    // Format the content
    let formatted_content = '';
    
    if (extracted_data && typeof extracted_data === 'object') {
        // Structured data
        formatted_content = format_cv_data(extracted_data);
    } else {
        // Plain text
        formatted_content = `<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6;">${frappe.utils.escape_html(extracted_text)}</pre>`;
    }

    // عرض النتائج في dialog
    let d = new frappe.ui.Dialog({
        title: __('AI CV Extraction Results'),
        size: 'large',
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'results_html',
                options: `
                    <div style="padding: 20px;">
                        <div style="background: linear-gradient(to right, #667eea, #764ba2); padding: 3px; border-radius: 10px; margin-bottom: 20px;">
                            <div style="background: white; padding: 20px; border-radius: 8px;">
                                <h4 style="margin: 0 0 15px 0; color: #667eea; display: flex; align-items: center;">
                                    <span style="font-size: 24px; margin-right: 10px;">📄</span>
                                    Extracted Information
                                </h4>
                                ${formatted_content}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <div style="flex: 1; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
                                <strong style="color: #1976d2;">💡 Next Steps:</strong>
                                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #555;">
                                    <li>Review the extracted information carefully</li>
                                    <li>Update relevant fields in the Job Applicant form</li>
                                    <li>Verify contact details and qualifications</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 12px; text-align: center; color: #666;">
                            <strong>Applicant:</strong> ${frappe.utils.escape_html(frm.doc.applicant_name || frm.doc.name)}
                            &nbsp;•&nbsp;
                            <strong>File:</strong> ${frappe.utils.escape_html(frm.doc.resume_attachment)}
                        </div>
                    </div>
                `
            }
        ],
        primary_action_label: __('Close'),
        primary_action: function() {
            d.hide();
        }
    });

    d.show();
}

function format_cv_data(data) {
    if (typeof data !== 'object' || data === null) {
        return `<pre style="white-space: pre-wrap;">${frappe.utils.escape_html(String(data))}</pre>`;
    }
    
    let html = '<div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">';
    
    // Group data into sections if possible
    const sections = {
        'Personal': ['name', 'email', 'phone', 'address', 'nationality', 'date_of_birth'],
        'Education': ['education', 'degree', 'university', 'graduation_year', 'qualifications'],
        'Experience': ['experience', 'work_history', 'employment', 'companies', 'positions'],
        'Skills': ['skills', 'technical_skills', 'soft_skills', 'languages', 'certifications'],
        'Other': []
    };
    
    let categorized = {};
    let used_keys = new Set();
    
    // Categorize fields
    for (let section in sections) {
        if (section === 'Other') continue;
        categorized[section] = {};
        
        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                let key_lower = key.toLowerCase();
                if (sections[section].some(s => key_lower.includes(s))) {
                    categorized[section][key] = data[key];
                    used_keys.add(key);
                }
            }
        }
    }
    
    // Add remaining fields to "Other"
    categorized['Other'] = {};
    for (let key in data) {
        if (data.hasOwnProperty(key) && !used_keys.has(key)) {
            categorized['Other'][key] = data[key];
        }
    }
    
    // Render sections
    for (let section in categorized) {
        let section_data = categorized[section];
        let keys = Object.keys(section_data);
        
        if (keys.length === 0) continue;
        
        html += `<div style="margin-bottom: 25px;">`;
        html += `<h5 style="color: #667eea; margin: 0 0 12px 0; font-size: 16px; border-bottom: 2px solid #667eea; padding-bottom: 5px;">${section}</h5>`;
        
        for (let key of keys) {
            let value = section_data[key];
            let formatted_value = '';
            
            if (Array.isArray(value)) {
                formatted_value = '<ul style="margin: 5px 0; padding-left: 20px;">';
                for (let item of value) {
                    if (typeof item === 'object') {
                        formatted_value += `<li><pre style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin: 4px 0;">${JSON.stringify(item, null, 2)}</pre></li>`;
                    } else {
                        formatted_value += `<li>${frappe.utils.escape_html(String(item))}</li>`;
                    }
                }
                formatted_value += '</ul>';
            } else if (typeof value === 'object' && value !== null) {
                formatted_value = `<pre style="margin: 5px 0; background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto;">${JSON.stringify(value, null, 2)}</pre>`;
            } else {
                formatted_value = `<span style="color: #333;">${frappe.utils.escape_html(String(value))}</span>`;
            }
            
            // Format key name (convert snake_case to Title Case)
            let display_key = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            html += `
                <div style="margin-bottom: 10px; padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #e0e0e0;">
                    <strong style="color: #555; display: block; margin-bottom: 4px; font-size: 13px;">${frappe.utils.escape_html(display_key)}</strong>
                    <div style="padding-left: 10px;">${formatted_value}</div>
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

// Add CSS for better presentation
if (!$('#cv-extraction-styles').length) {
    $('head').append(`
        <style id="cv-extraction-styles">
            .modal-dialog.modal-lg {
                max-width: 900px;
            }
            
            #langflow-widget-messages::-webkit-scrollbar {
                width: 8px;
            }
            
            #langflow-widget-messages::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            
            #langflow-widget-messages::-webkit-scrollbar-thumb {
                background: #667eea;
                border-radius: 4px;
            }
            
            #langflow-widget-messages::-webkit-scrollbar-thumb:hover {
                background: #764ba2;
            }
        </style>
    `);
}
