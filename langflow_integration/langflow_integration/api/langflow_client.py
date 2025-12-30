# langflow_integration/langflow_integration/api/langflow_client.py

import frappe
import requests
from frappe import _

@frappe.whitelist()
def call_langflow(flow_id, input_data, session_id=None):
    """
    استدعاء Langflow flow من ERPNext
    """
    try:
        # إعدادات Langflow
        langflow_url = frappe.conf.get("langflow_url") or "http://localhost:7860"
        langflow_api_key = frappe.conf.get("langflow_api_key")
        
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
        
        # إرسال الطلب
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        
        return {
            "success": True,
            "data": result,
            "message": _("Langflow executed successfully")
        }
        
    except Exception as e:
        frappe.log_error(f"Langflow API Error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def process_document_with_ai(doctype, docname, prompt):
    """
    معالجة مستند ERPNext باستخدام AI من Langflow
    """
    try:
        # جلب المستند
        doc = frappe.get_doc(doctype, docname)
        doc_data = doc.as_dict()
        
        # تحضير البيانات لـ Langflow
        input_text = f"{prompt}\n\nDocument Data:\n{frappe.as_json(doc_data)}"
        
        # استدعاء Langflow
        flow_id = frappe.conf.get("langflow_document_processor_id")
        result = call_langflow(flow_id, input_text)
        
        return result
        
    except Exception as e:
        frappe.log_error(f"AI Processing Error: {str(e)}")
        return {"success": False, "error": str(e)}