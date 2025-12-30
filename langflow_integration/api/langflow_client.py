"""
Langflow Integration API Client
Handles communication between ERPNext and Langflow AI platform
"""

import frappe
import requests
import json
from frappe import _
from frappe.utils import now_datetime, get_datetime


@frappe.whitelist()
def call_langflow(flow_id, input_data, session_id=None, tweaks=None, timeout=30):
    """
    استدعاء Langflow flow من ERPNext
    
    Args:
        flow_id: معرف الـ Flow في Langflow
        input_data: البيانات المدخلة (نص أو JSON)
        session_id: معرف الجلسة (اختياري)
        tweaks: تعديلات على معاملات الـ Flow (اختياري)
        timeout: وقت الانتظار الأقصى بالثواني
        
    Returns:
        dict: النتيجة مع حالة النجاح والبيانات
    """
    try:
        # التحقق من الصلاحيات
        if not frappe.has_permission("Langflow Integration", "read"):
            frappe.throw(_("You don't have permission to use Langflow Integration"))
        
        # إعدادات Langflow
        langflow_url = frappe.conf.get("langflow_url") or "http://localhost:7860"
        langflow_api_key = frappe.conf.get("langflow_api_key")
        
        if not flow_id:
            return {
                "success": False,
                "error": _("Flow ID is required")
            }
        
        # بناء الطلب
        url = f"{langflow_url}/api/v1/run/{flow_id}"
        
        headers = {
            "Content-Type": "application/json",
        }
        
        if langflow_api_key:
            headers["x-api-key"] = langflow_api_key
        
        payload = {
            "input_value": input_data,
            "output_type": "chat",
            "input_type": "chat",
        }
        
        if session_id:
            payload["session_id"] = session_id
            
        if tweaks:
            payload["tweaks"] = tweaks
        
        # تسجيل الطلب
        request_log = {
            "timestamp": now_datetime(),
            "flow_id": flow_id,
            "input_preview": str(input_data)[:200],
            "user": frappe.session.user
        }
        
        # إرسال الطلب
        response = requests.post(
            url, 
            json=payload, 
            headers=headers,
            timeout=timeout
        )
        response.raise_for_status()
        
        result = response.json()
        
        # تسجيل النجاح
        log_langflow_request(
            flow_id=flow_id,
            status="Success",
            request_data=request_log,
            response_data=result
        )
        
        return {
            "success": True,
            "data": result,
            "message": _("Langflow executed successfully"),
            "session_id": result.get("session_id")
        }
        
    except requests.exceptions.Timeout:
        error_msg = _("Request timeout - Langflow took too long to respond")
        frappe.log_error(f"Langflow Timeout: {flow_id}", "Langflow Integration")
        return {
            "success": False,
            "error": error_msg
        }
        
    except requests.exceptions.ConnectionError:
        error_msg = _("Cannot connect to Langflow server. Please check the URL and network connection.")
        frappe.log_error(f"Langflow Connection Error: {langflow_url}", "Langflow Integration")
        return {
            "success": False,
            "error": error_msg
        }
        
    except requests.exceptions.HTTPError as e:
        error_msg = f"HTTP Error {e.response.status_code}: {e.response.text}"
        frappe.log_error(f"Langflow HTTP Error: {error_msg}", "Langflow Integration")
        return {
            "success": False,
            "error": error_msg
        }
        
    except Exception as e:
        frappe.log_error(f"Langflow API Error: {str(e)}\n{frappe.get_traceback()}", "Langflow Integration")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def process_document_with_ai(doctype, docname, prompt, flow_id=None, include_fields=None):
    """
    معالجة مستند ERPNext باستخدام AI من Langflow
    
    Args:
        doctype: نوع المستند
        docname: اسم المستند
        prompt: الطلب أو السؤال
        flow_id: معرف الـ Flow (اختياري، يمكن أخذه من الإعدادات)
        include_fields: قائمة الحقول المطلوب تضمينها (اختياري)
        
    Returns:
        dict: النتيجة مع حالة النجاح والبيانات
    """
    try:
        # التحقق من الصلاحيات
        if not frappe.has_permission(doctype, "read", docname):
            frappe.throw(_("You don't have permission to access this document"))
        
        # جلب المستند
        doc = frappe.get_doc(doctype, docname)
        doc_data = doc.as_dict()
        
        # تصفية الحقول إذا تم تحديدها
        if include_fields:
            if isinstance(include_fields, str):
                include_fields = json.loads(include_fields)
            doc_data = {k: v for k, v in doc_data.items() if k in include_fields}
        
        # إزالة الحقول غير الضرورية
        fields_to_remove = [
            'modified_by', 'owner', 'idx', 'docstatus',
            '_user_tags', '_comments', '_assign', '_liked_by'
        ]
        for field in fields_to_remove:
            doc_data.pop(field, None)
        
        # تحضير البيانات لـ Langflow
        input_text = f"""
Prompt: {prompt}

Document Type: {doctype}
Document Name: {docname}

Document Data:
{json.dumps(doc_data, indent=2, ensure_ascii=False, default=str)}
"""
        
        # استدعاء Langflow
        if not flow_id:
            flow_id = frappe.conf.get("langflow_document_processor_id")
            
        if not flow_id:
            return {
                "success": False,
                "error": _("Flow ID not configured. Please set 'langflow_document_processor_id' in site_config.json")
            }
        
        result = call_langflow(flow_id, input_text)
        
        return result
        
    except Exception as e:
        frappe.log_error(f"AI Processing Error: {str(e)}\n{frappe.get_traceback()}", "Langflow Integration")
        return {
            "success": False, 
            "error": str(e)
        }


@frappe.whitelist()
def chat_with_langflow(message, flow_id=None, session_id=None):
    """
    محادثة بسيطة مع Langflow
    
    Args:
        message: الرسالة النصية
        flow_id: معرف الـ Flow
        session_id: معرف الجلسة للحفاظ على السياق
        
    Returns:
        dict: الرد من Langflow
    """
    try:
        if not flow_id:
            flow_id = frappe.conf.get("langflow_chat_flow_id")
            
        if not flow_id:
            return {
                "success": False,
                "error": _("Chat flow ID not configured")
            }
        
        result = call_langflow(
            flow_id=flow_id,
            input_data=message,
            session_id=session_id
        )
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Chat Error: {str(e)}", "Langflow Integration")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def test_connection():
    """
    اختبار الاتصال بـ Langflow
    
    Returns:
        dict: حالة الاتصال
    """
    try:
        langflow_url = frappe.conf.get("langflow_url") or "http://localhost:7860"
        
        # محاولة الوصول إلى صفحة الصحة
        response = requests.get(f"{langflow_url}/health", timeout=5)
        
        if response.status_code == 200:
            return {
                "success": True,
                "message": _("Successfully connected to Langflow"),
                "url": langflow_url
            }
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}",
                "url": langflow_url
            }
            
    except requests.exceptions.ConnectionError:
        return {
            "success": False,
            "error": _("Cannot connect to Langflow. Please check if Langflow is running."),
            "url": langflow_url
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def log_langflow_request(flow_id, status, request_data, response_data=None):
    """
    تسجيل طلبات Langflow (داخلي)
    """
    try:
        # يمكن إضافة DocType خاص للتسجيل لاحقاً
        frappe.logger().info(f"Langflow Request - Flow: {flow_id}, Status: {status}")
        
    except Exception as e:
        # لا نريد أن يفشل الطلب الأصلي بسبب خطأ في التسجيل
        frappe.logger().error(f"Failed to log Langflow request: {str(e)}")


@frappe.whitelist()
def get_langflow_config():
    """
    الحصول على إعدادات Langflow (للعرض فقط، بدون المفاتيح السرية)
    
    Returns:
        dict: الإعدادات
    """
    try:
        if not frappe.has_permission("System Settings", "read"):
            frappe.throw(_("Insufficient permissions"))
        
        config = {
            "langflow_url": frappe.conf.get("langflow_url") or "http://localhost:7860",
            "api_key_configured": bool(frappe.conf.get("langflow_api_key")),
            "document_processor_id": frappe.conf.get("langflow_document_processor_id"),
            "chat_flow_id": frappe.conf.get("langflow_chat_flow_id")
        }
        
        return {
            "success": True,
            "config": config
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
