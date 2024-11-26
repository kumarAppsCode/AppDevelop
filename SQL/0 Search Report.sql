CREATE OR REPLACE PACKAGE FS_NWS_REPORT_ACCESS_PKG AS

PROCEDURE GET_REPORT_RECORD (
   in_limit              IN NUMBER,
   in_offset             IN VARCHAR2,
   p_report_name         IN VARCHAR2 DEFAULT NULL,
   p_person_number       IN VARCHAR2 DEFAULT NULL,
   out_status            OUT VARCHAR2,
   out_description       OUT VARCHAR2,
   out_has_next          OUT VARCHAR2,
   out_total_count       OUT NUMBER,
   out_count             OUT NUMBER,
   p_output              OUT SYS_REFCURSOR
);

END FS_NWS_REPORT_ACCESS_PKG;
/


CREATE OR REPLACE PACKAGE BODY FS_NWS_REPORT_ACCESS_PKG 
AS
PROCEDURE GET_REPORT_RECORD (
   in_limit              IN NUMBER,
   in_offset             IN VARCHAR2,
   p_report_name         IN VARCHAR2 DEFAULT NULL,
   p_person_number           IN VARCHAR2 DEFAULT NULL,
   out_status            OUT VARCHAR2,
   out_description       OUT VARCHAR2,
   out_has_next          OUT VARCHAR2,
   out_total_count       OUT NUMBER,
   out_count             OUT NUMBER,
   p_output              OUT SYS_REFCURSOR
) IS
 
    lv_error_message       VARCHAR2(2000) := NULL;
    lv_status              CHAR(1) := 'N';
    lv_employee_records    SYS_REFCURSOR;
    lv_total_count         NUMBER;
    lv_count               NUMBER;


    l_sql                  VARCHAR2(4000);
    l_sql_count            VARCHAR2(4000);
    l_current_count_sql    VARCHAR2(4000);
    l_where                VARCHAR2(4000) := ' AND 1=1';
    l_order_by             VARCHAR2(100) := ' ORDER BY REPORT_ACCESS_ID desc';
    l_sql_err              VARCHAR2(4000) := 'select * from dual where 1=2';

BEGIN

    IF (p_report_name IS NOT NULL AND p_report_name != 'undefined') THEN 
        l_where := l_where || ' AND UPPER(REPORT_CODE) LIKE ''%' || UPPER(p_report_name) || '%''';
    END IF;

    IF (p_person_number IS NOT NULL AND p_person_number != 'undefined') THEN
        l_where := l_where || ' AND PERSON_NUMBER = ''' || p_person_number || '''';
    END IF;


    BEGIN
        l_sql_count := 'SELECT COUNT(*) FROM FS_NWS_REPORT_ACCESS_V WHERE 1 = 1 ' || l_where;
         DBMS_OUTPUT.PUT_LINE(l_sql_count); 
       EXECUTE IMMEDIATE l_sql_count INTO lv_total_count;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            lv_total_count := 0;
            lv_status := 'Y';
            lv_error_message := 'No records found. ' || SQLCODE || '-' || SQLERRM;
        WHEN OTHERS THEN
            lv_total_count := 0;
            lv_status := 'Y';
            lv_error_message := 'Failed at get total count of employee records step. ' || SQLCODE || '-' || SQLERRM;
    END;

    IF lv_total_count > 0 THEN
        l_sql := 'SELECT rd.* FROM FS_NWS_REPORT_ACCESS_V rd WHERE 1 = 1 ' 
            || l_where 
            || l_order_by
            || ' OFFSET ' || TO_NUMBER (in_offset) || ' ROWS'
            || ' FETCH NEXT ' || in_limit || ' ROWS ONLY';
    END IF;

    BEGIN
        l_current_count_sql := 'SELECT COUNT(*) FROM (SELECT * FROM FS_NWS_REPORT_ACCESS_V rd WHERE 1 = 1 ' 
            || l_where
            || l_order_by
            || ' OFFSET ' || TO_NUMBER (in_offset) || ' ROWS'
            || ' FETCH NEXT ' || in_limit || ' ROWS ONLY)';

        EXECUTE IMMEDIATE l_current_count_sql INTO out_count;
		 DBMS_OUTPUT.PUT_LINE(out_count); 
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            out_count := 0;
            lv_status := 'Y';
            lv_error_message := 'No records found. ' || SQLCODE || '-' || SQLERRM;
        WHEN OTHERS THEN
            out_count := 0;
            lv_status := 'Y';
            lv_error_message := 'Failed at get total count records step. ' || SQLCODE || '-' || SQLERRM;
    END;

    IF (out_count + TO_NUMBER(in_offset)) >= lv_total_count THEN
        out_has_next := 'N';
    ELSE
        out_has_next := 'Y';
    END IF;

    IF lv_status = 'N' THEN
        out_status := 'SUCCESS';
        out_description := 'Successfully fetched employee records';
        out_total_count := lv_total_count;
		DBMS_OUTPUT.PUT_LINE(l_sql); 
        OPEN p_output FOR l_sql;
    ELSE
        out_status := 'ERROR';
        out_description := lv_error_message;
        out_total_count := lv_total_count;
			DBMS_OUTPUT.PUT_LINE(l_sql_err);
        --OPEN p_output FOR l_sql_err;
    END IF;

EXCEPTION 
    WHEN OTHERS THEN 
        out_has_next := 'N';
        out_total_count := 0;
        out_count := 0;
        out_status := 'ERROR';
        out_description := 'ERROR Description: ' || lv_error_message;
        OPEN p_output FOR l_sql_err;
END GET_REPORT_RECORD;

END FS_NWS_REPORT_ACCESS_PKG;
/
