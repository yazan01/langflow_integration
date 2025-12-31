frappe.ui.form.on('Job Applicant', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            // Add AI Extract CV button
            frm.add_custom_button(__('AI Extract CV'), function() {
                extract_cv_with_ai(frm);
            }).css({
                'background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'color': 'white',
                'border': 'none',
                'font-weight': '600'
            });
        }
    }
});

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

    // عرض مؤشر التحميل
    frappe.show_alert({
        message: __('Extracting CV data with AI...'),
        indicator: 'blue'
    }, 3);

    // الحصول على الـ Flow ID من الإعدادات
    let cv_flow_id = frappe.boot.sysdefaults.langflow_cv_extract_flow_id || 
                     frappe.sys_defaults.langflow_cv_extract_flow_id;

    // إرسال الطلب
    frappe.call({
        method: 'langflow_integration.langflow_integration.api.langflow_client.extract_cv_data',
        args: {
            applicant_name: frm.doc.name,
            cv_file_url: frm.doc.resume_attachment,
            flow_id: cv_flow_id
        },
        freeze: true,
        freeze_message: __('AI is processing your CV...'),
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.show_alert({
                    message: __('CV extracted successfully!'),
                    indicator: 'green'
                }, 5);

                // عرض النتائج في dialog
                show_cv_extraction_results(r.message.data, frm);
            } else {
                frappe.msgprint({
                    title: __('Extraction Failed'),
                    indicator: 'red',
                    message: r.message.error || __('Unknown error occurred')
                });
            }
        },
        error: function(r) {
            frappe.msgprint({
                title: __('Error'),
                indicator: 'red',
                message: __('Failed to connect to AI service')
            });
        }
    });
}

function show_cv_extraction_results(data, frm) {
    // استخراج النص من response
    let extracted_text = '';
    
    try {
        if (data.outputs && data.outputs[0]) {
            let output = data.outputs[0];
            if (output.outputs && output.outputs[0]) {
                let result = output.outputs[0];
                
                if (result.results && result.results.message) {
                    extracted_text = typeof result.results.message === 'string' 
                        ? result.results.message 
                        : result.results.message.text || JSON.stringify(result.results.message);
                } else if (result.message) {
                    extracted_text = typeof result.message === 'string'
                        ? result.message
                        : result.message.text || JSON.stringify(result.message);
                }
            }
        }
        
        if (!extracted_text) {
            extracted_text = JSON.stringify(data, null, 2);
        }
    } catch (e) {
        extracted_text = JSON.stringify(data, null, 2);
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
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <h4 style="margin-top: 0; color: #667eea;">📄 Extracted Information</h4>
                            <div style="white-space: pre-wrap; font-family: monospace; font-size: 13px; line-height: 1.6;">
                                ${frappe.utils.escape_html(extracted_text)}
                            </div>
                        </div>
                        <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 6px; font-size: 12px;">
                            <strong>💡 Tip:</strong> Review the extracted information and update the Job Applicant fields manually if needed.
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
