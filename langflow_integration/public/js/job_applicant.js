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

    // نمرر فقط الـ URL النسبي - الـ backend سيتعامل مع المسار الكامل
    let cv_file_url = frm.doc.resume_attachment;
    
    console.log('📄 CV File URL (relative):', cv_file_url);
    console.log('📋 Applicant Name:', frm.doc.name);

    // عرض مؤشر التحميل
    frappe.show_alert({
        message: __('Extracting CV data with AI...'),
        indicator: 'blue'
    }, 3);

    // استدعاء API - نمرر فقط المعلومات الأساسية
    // الـ backend سيتعامل مع:
    // 1. جلب Flow ID من site_config.json
    // 2. بناء المسار الكامل للملف
    // 3. قراءة محتوى الملف
    // 4. إرسال الطلب لـ Langflow
    frappe.call({
        method: 'langflow_integration.langflow_integration.api.langflow_client.extract_cv_data',
        args: {
            applicant_name: frm.doc.name,
            cv_file_url: cv_file_url
            // لا flow_id - سيتم جلبه من site_config
            // لا مسار كامل - سيتم بناءه في الـ backend
        },
        freeze: true,
        freeze_message: __('AI is processing your CV...'),
        callback: function(r) {
            console.log('📥 Full Response:', r);
            
            if (r.message && r.message.success) {
                console.log('✅ Success! Data received');
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
                    message: `<div style="line-height: 1.6;">
                        <p style="margin-bottom: 10px;"><strong>خطأ في استخراج البيانات:</strong></p>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 3px solid #dc3545;">
                            ${error_msg}
                        </div>
                        <div style="margin-top: 15px; font-size: 13px;">
                            <strong>💡 نصائح لحل المشكلة:</strong>
                            <ul style="margin-top: 8px; padding-left: 20px;">
                                <li>تأكد من أن Langflow يعمل على: <code>http://localhost:7860</code></li>
                                <li>تحقق من أن الـ Flow ID صحيح في site_config.json</li>
                                <li>تأكد من وجود الملف وإمكانية الوصول إليه</li>
                                <li>راجع الـ Error Log في ERPNext للمزيد من التفاصيل</li>
                            </ul>
                        </div>
                    </div>`
                });
            }
        },
        error: function(r) {
            console.error('❌ API Error:', r);
            
            let error_detail = '<div style="line-height: 1.6;">';
            error_detail += '<p style="margin-bottom: 10px;"><strong>فشل الاتصال بخدمة AI</strong></p>';
            
            if (r.exception) {
                error_detail += '<div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-top: 10px; max-height: 200px; overflow: auto;">';
                error_detail += '<pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 11px;">' + 
                               frappe.utils.escape_html(r.exception) + '</pre>';
                error_detail += '</div>';
            }
            
            if (r._server_messages) {
                try {
                    let messages = JSON.parse(r._server_messages);
                    error_detail += '<div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;">';
                    error_detail += '<strong>رسائل الخادم:</strong><br>';
                    messages.forEach(msg => {
                        let parsed = JSON.parse(msg);
                        error_detail += `<div style="margin-top: 5px;">${parsed.message}</div>`;
                    });
                    error_detail += '</div>';
                } catch (e) {
                    // Ignore parsing errors
                }
            }
            
            error_detail += '</div>';
            
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
                
                // Try to get the message from different possible locations
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
                } else if (result.results) {
                    extracted_text = JSON.stringify(result.results, null, 2);
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
            // Not JSON, that's fine - we'll display as text
            console.log('Not JSON data, displaying as text');
        }
        
    } catch (e) {
        console.error('Error parsing results:', e);
        extracted_text = JSON.stringify(data, null, 2);
    }

    // Format the content
    let formatted_content = '';
    
    if (extracted_data && typeof extracted_data === 'object') {
        // Structured data - format nicely
        formatted_content = format_cv_data(extracted_data);
    } else {
        // Plain text - display with nice formatting
        formatted_content = `
            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0;">
                <pre style="
                    white-space: pre-wrap; 
                    word-wrap: break-word; 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    line-height: 1.8;
                    margin: 0;
                    font-size: 14px;
                    color: #333;
                ">${frappe.utils.escape_html(extracted_text)}</pre>
            </div>
        `;
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
                        <!-- Header with gradient -->
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; margin-bottom: 25px; color: white;">
                            <h3 style="margin: 0 0 8px 0; display: flex; align-items: center; font-size: 20px;">
                                <span style="font-size: 28px; margin-left: 12px;">📄</span>
                                <span>نتائج استخراج السيرة الذاتية</span>
                            </h3>
                            <div style="opacity: 0.9; font-size: 14px; display: flex; gap: 20px; margin-top: 12px;">
                                <span><strong>المتقدم:</strong> ${frappe.utils.escape_html(frm.doc.applicant_name || frm.doc.name)}</span>
                                <span><strong>الملف:</strong> ${frappe.utils.escape_html(frm.doc.resume_attachment.split('/').pop())}</span>
                            </div>
                        </div>
                        
                        <!-- Content -->
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            ${formatted_content}
                        </div>
                        
                        <!-- Action Cards -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
                            <div style="padding: 15px; background: #e3f2fd; border-radius: 8px; border-right: 4px solid #2196f3;">
                                <strong style="color: #1976d2; display: block; margin-bottom: 8px;">💡 الخطوات التالية</strong>
                                <ul style="margin: 0; padding-right: 20px; font-size: 13px; color: #555; line-height: 1.6;">
                                    <li>راجع المعلومات المستخرجة بعناية</li>
                                    <li>حدّث الحقول المناسبة في النموذج</li>
                                    <li>تحقق من بيانات الاتصال والمؤهلات</li>
                                </ul>
                            </div>
                            
                            <div style="padding: 15px; background: #f3e5f5; border-radius: 8px; border-right: 4px solid #9c27b0;">
                                <strong style="color: #7b1fa2; display: block; margin-bottom: 8px;">🤖 تم بواسطة AI</strong>
                                <p style="margin: 0; font-size: 13px; color: #555; line-height: 1.6;">
                                    تم استخراج هذه البيانات تلقائياً باستخدام الذكاء الاصطناعي. قد تحتاج بعض المعلومات إلى مراجعة يدوية.
                                </p>
                            </div>
                        </div>
                        
                        <!-- Footer info -->
                        <div style="margin-top: 20px; padding: 12px; background: #f8f9fa; border-radius: 6px; text-align: center; font-size: 12px; color: #666; border-top: 2px solid #e0e0e0;">
                            <strong>⚡ Powered by Langflow AI</strong>
                            <span style="margin: 0 8px;">•</span>
                            <span>Session: ${new Date().toLocaleString('ar-SA')}</span>
                        </div>
                    </div>
                `
            }
        ],
        primary_action_label: __('إغلاق'),
        primary_action: function() {
            d.hide();
        }
    });

    d.show();
}

function format_cv_data(data) {
    if (typeof data !== 'object' || data === null) {
        return `<div style="background: white; padding: 15px; border-radius: 6px;">
                    <pre style="white-space: pre-wrap; margin: 0;">${frappe.utils.escape_html(String(data))}</pre>
                </div>`;
    }
    
    let html = '<div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">';
    
    // Define section categories in Arabic
    const sections = {
        'معلومات شخصية': ['name', 'full_name', 'email', 'phone', 'mobile', 'address', 'nationality', 'date_of_birth', 'gender', 'marital_status'],
        'التعليم': ['education', 'degree', 'university', 'graduation_year', 'qualifications', 'major', 'gpa', 'academic'],
        'الخبرات': ['experience', 'work_history', 'employment', 'companies', 'positions', 'job_title', 'responsibilities'],
        'المهارات': ['skills', 'technical_skills', 'soft_skills', 'competencies', 'tools'],
        'اللغات': ['languages', 'language_skills'],
        'الشهادات': ['certifications', 'certificates', 'awards', 'achievements'],
        'أخرى': []
    };
    
    let categorized = {};
    let used_keys = new Set();
    
    // Categorize fields
    for (let section in sections) {
        if (section === 'أخرى') continue;
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
    categorized['أخرى'] = {};
    for (let key in data) {
        if (data.hasOwnProperty(key) && !used_keys.has(key)) {
            categorized['أخرى'][key] = data[key];
        }
    }
    
    // Render sections
    for (let section in categorized) {
        let section_data = categorized[section];
        let keys = Object.keys(section_data);
        
        if (keys.length === 0) continue;
        
        html += `<div style="margin-bottom: 25px;">`;
        html += `<h5 style="
            color: #667eea; 
            margin: 0 0 15px 0; 
            font-size: 17px; 
            border-bottom: 2px solid #667eea; 
            padding-bottom: 8px;
            display: flex;
            align-items: center;
        ">
            <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                         color: white; 
                         width: 30px; 
                         height: 30px; 
                         border-radius: 50%; 
                         display: inline-flex; 
                         align-items: center; 
                         justify-content: center; 
                         margin-left: 10px; 
                         font-size: 16px;">
                ${get_section_icon(section)}
            </span>
            ${section}
        </h5>`;
        
        for (let key of keys) {
            let value = section_data[key];
            let formatted_value = '';
            
            if (Array.isArray(value)) {
                formatted_value = '<ul style="margin: 5px 0; padding-right: 25px; line-height: 1.8;">';
                for (let item of value) {
                    if (typeof item === 'object') {
                        formatted_value += `<li style="margin: 5px 0;"><pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 4px 0; font-size: 12px; overflow-x: auto;">${JSON.stringify(item, null, 2)}</pre></li>`;
                    } else {
                        formatted_value += `<li style="margin: 5px 0;">${frappe.utils.escape_html(String(item))}</li>`;
                    }
                }
                formatted_value += '</ul>';
            } else if (typeof value === 'object' && value !== null) {
                formatted_value = `<pre style="margin: 5px 0; background: #f8f9fa; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto; border: 1px solid #e0e0e0;">${JSON.stringify(value, null, 2)}</pre>`;
            } else {
                formatted_value = `<span style="color: #333; font-size: 14px;">${frappe.utils.escape_html(String(value))}</span>`;
            }
            
            // Format key name (convert snake_case to Title Case)
            let display_key = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            html += `
                <div style="
                    margin-bottom: 12px; 
                    padding: 12px; 
                    background: white; 
                    border-radius: 6px; 
                    border-right: 3px solid #667eea;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                ">
                    <strong style="
                        color: #555; 
                        display: block; 
                        margin-bottom: 6px; 
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">${frappe.utils.escape_html(display_key)}</strong>
                    <div style="padding-right: 12px;">${formatted_value}</div>
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

function get_section_icon(section) {
    const icons = {
        'معلومات شخصية': '👤',
        'التعليم': '🎓',
        'الخبرات': '💼',
        'المهارات': '⚡',
        'اللغات': '🌐',
        'الشهادات': '🏆',
        'أخرى': '📋'
    };
    return icons[section] || '📄';
}

// Add CSS for better presentation
if (!$('#cv-extraction-styles').length) {
    $('head').append(`
        <style id="cv-extraction-styles">
            .modal-dialog.modal-lg {
                max-width: 950px;
            }
            
            /* Scrollbar styling */
            .modal-body::-webkit-scrollbar {
                width: 10px;
            }
            
            .modal-body::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 10px;
            }
            
            .modal-body::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
            }
            
            .modal-body::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            }
            
            /* Fade-in animation */
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .frappe-control[data-fieldname="results_html"] > div {
                animation: fadeIn 0.4s ease-out;
            }
        </style>
    `);
}
