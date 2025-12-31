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




