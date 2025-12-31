frappe.ui.form.on('Job Applicant', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            // Add AI Analysis button
            frm.add_custom_button(__('AI Analysis'), function() {
                analyze_job_applicant_with_ai(frm);
            }, __('Langflow'));
            
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

