"""
Langflow Integration API Client - OPTIMIZED VERSION
Handles communication between ERPNext and Langflow AI platform with enhanced security, performance, and error handling
"""

import frappe
import requests
import json
import hashlib
import sqlparse
from frappe import _
from frappe.utils import now_datetime, cint
from typing import Dict, List, Optional, Any


# ============================================
# CONFIGURATION & CONSTANTS
# ============================================

DANGEROUS_SQL_KEYWORDS = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE', 'ALTER', 'CREATE']
MAX_REQUESTS_PER_HOUR = 100
QUERY_TIMEOUT_SECONDS = 15
CACHE_TTL_SECONDS = 300  # 5 minutes


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_langflow_config():
    """Get Langflow configuration from site_config"""
    return {
        'url': frappe.conf.get("langflow_url") or "http://localhost:7860",
        'api_key': frappe.conf.get("langflow_api_key"),
        'cv_extract_flow_id': frappe.conf.get("langflow_cv_extract_flow_id"),
        'document_processor_id': frappe.conf.get("langflow_document_processor_id"),
        'chat_flow_id': frappe.conf.get("langflow_chat_flow_id")
    }


def check_rate_limit(user: str = None) -> bool:
    """
    Check if user has exceeded rate limit
    
    Args:
        user: Username to check (defaults to current user)
        
    Returns:
        bool: True if within limit, raises exception otherwise
    """
    if not user:
        user = frappe.session.user
    
    cache_key = f"langflow_rate_limit:{user}"
    request_count = cint(frappe.cache().get_value(cache_key) or 0)
    
    if request_count >= MAX_REQUESTS_PER_HOUR:
        frappe.throw(
            _("Rate limit exceeded. Maximum {0} requests per hour allowed.").format(MAX_REQUESTS_PER_HOUR),
            title=_("Rate Limit Exceeded")
        )
    
    # Increment counter
    frappe.cache().set_value(cache_key, request_count + 1, expires_in_sec=3600)
    return True


def get_query_hash(query: str) -> str:
    """Generate hash for query caching"""
    return hashlib.md5(query.encode()).hexdigest()


def get_cached_query_result(query_hash: str) -> Optional[List[Dict]]:
    """Get cached query result"""
    cache_key = f"langflow_query_result:{query_hash}"
    cached = frappe.cache().get_value(cache_key)
    
    if cached:
        frappe.logger().info(f"Cache hit for query: {query_hash[:8]}...")
        return json.loads(cached)
    
    return None


def set_cached_query_result(query_hash: str, result: List[Dict], ttl: int = CACHE_TTL_SECONDS):
    """Cache query result"""
    cache_key = f"langflow_query_result:{query_hash}"
    frappe.cache().set_value(
        cache_key,
        json.dumps(result, default=str),
        expires_in_sec=ttl
    )


def get_optimized_schema(doctype: str, include_child_tables: bool = True) -> Dict:
    """
    Get optimized schema with only important fields
    
    Args:
        doctype: DocType name
        include_child_tables: Include child table schemas
        
    Returns:
        dict: Optimized schema structure
    """
    meta = frappe.get_meta(doctype)
    
    # Important field types only
    important_fieldtypes = [
        'Data', 'Text', 'Link', 'Select', 'Int', 'Float', 'Currency',
        'Date', 'Datetime', 'Check', 'Table', 'Long Text'
    ]
    
    # Get important fields only
    important_fields = [
        {
            "name": f.fieldname,
            "type": f.fieldtype,
            "label": f.label,
            "options": f.options if f.fieldtype in ['Link', 'Select', 'Table'] else None,
            "reqd": f.reqd
        }
        for f in meta.fields
        if f.fieldtype in important_fieldtypes and not f.hidden
    ]
    
    schema = {
        "doctype": meta.name,
        "label": meta.get_label(),
        "fields": important_fields
    }
    
    # Add child tables if needed
    if include_child_tables:
        child_tables = []
        for field in meta.fields:
            if field.fieldtype == "Table" and field.options:
                child_meta = frappe.get_meta(field.options)
                child_fields = [
                    {
                        "name": f.fieldname,
                        "type": f.fieldtype,
                        "label": f.label,
                        "options": f.options if f.fieldtype in ['Link', 'Select'] else None
                    }
                    for f in child_meta.fields
                    if f.fieldtype in important_fieldtypes and not f.hidden
                ]
                
                child_tables.append({
                    "doctype": child_meta.name,
                    "label": child_meta.get_label(),
                    "parent_field": field.fieldname,
                    "fields": child_fields
                })
        
        if child_tables:
            schema["child_tables"] = child_tables
    
    return schema


# ============================================
# SQL VALIDATION & SECURITY
# ============================================

def extract_tables_from_query(query: str) -> List[str]:
    """Extract table names from SQL query"""
    tables = []
    
    try:
        parsed = sqlparse.parse(query)[0]
        tokens = [token for token in parsed.flatten() if token.ttype is None]
        
        for i, token in enumerate(tokens):
            if token.value.upper() in ('FROM', 'JOIN'):
                # Next non-whitespace token should be table name
                for next_token in tokens[i+1:]:
                    if not next_token.is_whitespace:
                        # Remove backticks and extract table name
                        table_name = next_token.value.strip('`').strip()
                        if table_name:
                            tables.append(table_name)
                        break
    except Exception as e:
        frappe.log_error(f"Error extracting tables: {str(e)}", "SQL Parser")
    
    return tables


def get_user_allowed_tables(user: str = None) -> List[str]:
    """
    Get list of tables user has permission to access
    
    Args:
        user: Username (defaults to current user)
        
    Returns:
        list: List of allowed table names (with 'tab' prefix)
    """
    if not user:
        user = frappe.session.user
    
    # Get all doctypes user has read permission for
    allowed_doctypes = frappe.get_all(
        "DocType",
        filters={"issingle": 0},
        fields=["name"]
    )
    
    allowed_tables = []
    for dt in allowed_doctypes:
        if frappe.has_permission(dt.name, "read", user=user):
            allowed_tables.append(f"tab{dt.name}")
            
            # Add child tables
            meta = frappe.get_meta(dt.name)
            for field in meta.fields:
                if field.fieldtype == "Table" and field.options:
                    allowed_tables.append(f"tab{field.options}")
    
    return allowed_tables


def validate_sql_query(query: str, doctype: str = None) -> Dict[str, Any]:
    """
    Validate SQL query for security and correctness
    
    Args:
        query: SQL query to validate
        doctype: Primary DocType being queried (optional)
        
    Returns:
        dict: Validation result with is_valid and error message
    """
    try:
        # 1. Check if empty
        if not query or not query.strip():
            return {"is_valid": False, "error": "Query is empty"}
        
        # 2. Parse query
        try:
            parsed = sqlparse.parse(query)
            if not parsed:
                return {"is_valid": False, "error": "Failed to parse SQL query"}
            
            statement = parsed[0]
        except Exception as e:
            return {"is_valid": False, "error": f"SQL syntax error: {str(e)}"}
        
        # 3. Check if SELECT only
        query_type = statement.get_type()
        if query_type != 'SELECT':
            return {
                "is_valid": False,
                "error": f"Only SELECT queries are allowed. Detected: {query_type}"
            }
        
        # 4. Check for dangerous keywords
        query_upper = query.upper()
        for keyword in DANGEROUS_SQL_KEYWORDS:
            if keyword in query_upper:
                return {
                    "is_valid": False,
                    "error": f"Dangerous SQL keyword detected: {keyword}"
                }
        
        # 5. Extract and validate table access
        tables = extract_tables_from_query(query)
        if not tables:
            return {"is_valid": False, "error": "No tables found in query"}
        
        allowed_tables = get_user_allowed_tables()
        
        for table in tables:
            if table not in allowed_tables:
                # Remove 'tab' prefix for display
                display_table = table[3:] if table.startswith('tab') else table
                return {
                    "is_valid": False,
                    "error": f"You don't have permission to access table: {display_table}"
                }
        
        # 6. Check if docstatus filter exists (recommended)
        if 'docstatus' not in query_upper:
            # Warning but not blocking
            frappe.logger().warning(f"Query missing docstatus filter: {query[:100]}...")
        
        return {"is_valid": True, "query": query}
        
    except Exception as e:
        frappe.log_error(f"Query validation error: {str(e)}", "SQL Validator")
        return {"is_valid": False, "error": f"Validation error: {str(e)}"}


def execute_validated_query(query: str, use_cache: bool = True) -> Dict[str, Any]:
    """
    Execute validated SQL query with caching and timeout
    
    Args:
        query: Validated SQL query
        use_cache: Use query result caching
        
    Returns:
        dict: Execution result
    """
    try:
        # Check cache first
        if use_cache:
            query_hash = get_query_hash(query)
            cached_result = get_cached_query_result(query_hash)
            
            if cached_result is not None:
                return {
                    "success": True,
                    "data": cached_result,
                    "cached": True,
                    "count": len(cached_result)
                }
        
        # Execute query with timeout
        start_time = frappe.utils.now()
        
        try:
            result = frappe.db.sql(query, as_dict=True, timeout=QUERY_TIMEOUT_SECONDS)
        except frappe.QueryTimeoutError:
            return {
                "success": False,
                "error": f"Query execution timeout after {QUERY_TIMEOUT_SECONDS} seconds"
            }
        except frappe.db.DatabaseError as e:
            return {
                "success": False,
                "error": f"Database error: {str(e)}"
            }
        
        execution_time = (frappe.utils.now() - start_time).total_seconds()
        
        # Cache result
        if use_cache and result:
            set_cached_query_result(query_hash, result)
        
        return {
            "success": True,
            "data": result,
            "cached": False,
            "count": len(result),
            "execution_time": execution_time
        }
        
    except Exception as e:
        frappe.log_error(f"Query execution error: {str(e)}", "SQL Executor")
        return {
            "success": False,
            "error": str(e)
        }


# ============================================
# LANGFLOW API FUNCTIONS
# ============================================

@frappe.whitelist()
def call_langflow(flow_id, input_data, session_id=None, tweaks=None, timeout=30):
    """
    Call Langflow flow with enhanced error handling
    
    Args:
        flow_id: Flow ID in Langflow
        input_data: Input data (text or JSON)
        session_id: Session ID (optional)
        tweaks: Flow parameter tweaks (optional)
        timeout: Request timeout
        
    Returns:
        dict: Result with success status and data
    """
    try:
        # Check authentication
        if frappe.session.user == 'Guest':
            frappe.throw(_("Please login to use this feature"))
        
        # Rate limiting
        check_rate_limit()
        
        # Get configuration
        config = get_langflow_config()
        
        if not flow_id:
            return {
                "success": False,
                "error": _("Flow ID is required")
            }
        
        # Build request
        url = f"{config['url']}/api/v1/run/{flow_id}"
        
        headers = {
            "Content-Type": "application/json",
        }
        
        if config['api_key']:
            headers["x-api-key"] = config['api_key']
        
        payload = {
            "input_value": str(input_data),
            "output_type": "chat",
            "input_type": "chat",
        }
        
        if session_id:
            payload["session_id"] = str(session_id)
            
        if tweaks and isinstance(tweaks, dict):
            payload["tweaks"] = tweaks
        
        # Log request
        frappe.logger().info(f"Langflow request - Flow: {flow_id}, User: {frappe.session.user}")
        
        # Send request
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=timeout
        )
        response.raise_for_status()
        
        result = response.json()
        
        return {
            "success": True,
            "data": result,
            "message": _("Langflow executed successfully"),
            "session_id": result.get("session_id")
        }
        
    except requests.exceptions.Timeout:
        error_msg = _("Request timeout - Langflow took too long to respond")
        frappe.log_error(f"Langflow Timeout: {flow_id}", "Langflow Integration")
        return {"success": False, "error": error_msg}
        
    except requests.exceptions.ConnectionError:
        config = get_langflow_config()
        error_msg = _("Cannot connect to Langflow server at {0}").format(config['url'])
        frappe.log_error(f"Langflow Connection Error: {config['url']}", "Langflow Integration")
        return {"success": False, "error": error_msg}
        
    except requests.exceptions.HTTPError as e:
        try:
            error_detail = e.response.json()
            error_msg = f"HTTP {e.response.status_code}: {json.dumps(error_detail, ensure_ascii=False)}"
        except:
            error_msg = f"HTTP {e.response.status_code}: {e.response.text}"
        
        frappe.log_error(f"Langflow HTTP Error: {error_msg}", "Langflow Integration")
        return {"success": False, "error": error_msg}
        
    except Exception as e:
        frappe.log_error(f"Langflow API Error: {str(e)}\n{frappe.get_traceback()}", "Langflow Integration")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def chat_with_langflow(message, flow_id=None, session_id=None, doctype=None):
    """
    Chat with Langflow - OPTIMIZED VERSION
    - Permission checks
    - Optimized schema injection
    - Enhanced prompts
    """
    try:
        # ===== SECURITY CHECKS =====
        if frappe.session.user == 'Guest':
            frappe.throw(_("Please login to use this feature"))
        
        # Check DocType permission
        if doctype and not frappe.has_permission(doctype, "read"):
            frappe.throw(_("You don't have permission to access {0}").format(doctype))
        
        # Rate limiting
        check_rate_limit()
        
        # ===== CONFIGURATION =====
        config = get_langflow_config()
        if not flow_id:
            flow_id = config['chat_flow_id']
        
        if not flow_id:
            return {
                "success": False,
                "error": _("Chat flow ID not configured")
            }
        
        if not session_id:
            session_id = frappe.generate_hash(length=32)
        
        # ===== SCHEMA INJECTION (First Message Only) =====
        cache = frappe.cache()
        cache_key = f"langflow_session_init:{session_id}"
        
        context_prefix = ""
        is_first_message = not cache.get_value(cache_key)
        
        if is_first_message and doctype:
            # Mark session as initialized
            cache.set_value(cache_key, True, expires_in_sec=3600)
            
            # Get optimized schema
            schema = get_optimized_schema(doctype, include_child_tables=True)
            schema_json = json.dumps(schema, indent=2, ensure_ascii=False)
            
            # Enhanced system prompt
            context_prefix = f"""
أنت مساعد ذكي متخصص في ERPNext/Frappe Framework.

## المعلومات المتاحة:
DocType: {doctype}

## الهيكل (Schema):
```json
{schema_json}
```

## قواعد مهمة:
1. **للاستعلامات SQL:**
   - استخدم backticks: `tabDocTypeName`
   - دائماً استبعد السجلات الملغاة: WHERE docstatus != 2
   - للعلاقات Parent-Child: LEFT JOIN مع parenttype
   
2. **للإجابات:**
   - كن واضحاً ومباشراً
   - استخدم الأمثلة عند الحاجة
   - اشرح الاستعلامات المعقدة

3. **الأمان:**
   - فقط استعلامات SELECT
   - لا تستخدم: DROP, DELETE, UPDATE, INSERT
   - تحقق من الصلاحيات دائماً
"""
        
        # ===== ENHANCED PROMPT =====
        enhanced_message = f"{context_prefix}\n\n## السؤال:\n{message}" if context_prefix else message
        
        # ===== CALL LANGFLOW =====
        result = call_langflow(
            flow_id=flow_id,
            input_data=enhanced_message,
            session_id=session_id
        )
        
        return result
        
    except Exception as e:
        frappe.log_error(
            message=f"{str(e)}\n{frappe.get_traceback()}",
            title="Langflow Chat Error"
        )
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def validate_and_run_query(query, doctype=None):
    """
    Validate and execute SQL query
    
    Args:
        query: SQL query to execute
        doctype: Primary DocType (optional, for permission check)
        
    Returns:
        dict: Execution result
    """
    try:
        # Permission check
        if doctype and not frappe.has_permission(doctype, "read"):
            return {
                "success": False,
                "error": _("You don't have permission to access {0}").format(doctype)
            }
        
        # Validate query
        validation = validate_sql_query(query, doctype)
        
        if not validation.get("is_valid"):
            return {
                "success": False,
                "error": validation.get("error"),
                "validation_failed": True
            }
        
        # Execute query
        result = execute_validated_query(validation["query"])
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Query execution error: {str(e)}", "Query Validator")
        return {
            "success": False,
            "error": str(e)
        }


# ============================================
# LEGACY FUNCTIONS (Maintained for compatibility)
# ============================================

@frappe.whitelist()
def extract_cv_data(applicant_name, cv_file_url, flow_id=None):
    """Extract CV data using AI - Legacy function"""
    # ... (keep existing implementation)
    pass


@frappe.whitelist()
def process_document_with_ai(doctype, docname, prompt, flow_id=None, include_fields=None):
    """Process document with AI - Legacy function"""
    # ... (keep existing implementation)
    pass


@frappe.whitelist()
def test_connection():
    """Test Langflow connection"""
    try:
        config = get_langflow_config()
        response = requests.get(f"{config['url']}/health", timeout=5)
        
        if response.status_code == 200:
            return {
                "success": True,
                "message": _("Successfully connected to Langflow"),
                "url": config['url']
            }
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}",
                "url": config['url']
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "url": config.get('url', 'Unknown')
        }
