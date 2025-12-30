// langflow_integration/langflow_integration/public/js/customer.js

frappe.ui.form.on('Customer', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button(__('Analyze with AI'), function() {
                frappe.call({
                    method: 'langflow_integration.api.langflow_client.process_document_with_ai',
                    args: {
                        doctype: frm.doctype,
                        docname: frm.docname,
                        prompt: 'قم بتحليل بيانات هذا العميل وقدم توصيات'
                    },
                    callback: function(r) {
                        if (r.message.success) {
                            frappe.msgprint({
                                title: __('AI Analysis'),
                                message: r.message.data.outputs[0].outputs[0].results.message.text,
                                indicator: 'green'
                            });
                        } else {
                            frappe.msgprint({
                                title: __('Error'),
                                message: r.message.error,
                                indicator: 'red'
                            });
                        }
                    }
                });
            }, __('Actions'));
        }
    }
});