"""
Database connection and utility functions
"""
import os
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    """
    Create a database connection using environment variables.
    
    Returns:
        psycopg2 connection object
    """
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME", "homelessness_kpi"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        cursor_factory=RealDictCursor
    )

def execute_query(query: str, params: Optional[tuple] = None, fetch: str = "all"):
    """
    Execute a SQL query and return results.
    
    Args:
        query: SQL query string
        params: Optional parameters for query
        fetch: "all", "one", or None for no fetch
        
    Returns:
        Query results or None
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            
            if fetch == "all":
                return cur.fetchall()
            elif fetch == "one":
                return cur.fetchone()
            return None
    finally:
        conn.close()

def execute_write(query: str, params: Optional[tuple] = None):
    """
    Execute a write operation (INSERT, UPDATE, DELETE).
    
    Args:
        query: SQL query string
        params: Optional parameters for query
        
    Returns:
        Number of affected rows
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            conn.commit()
            return cur.rowcount
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()