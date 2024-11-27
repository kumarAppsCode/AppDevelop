create or replace PROCEDURE "UPLOAD_PRO" (
										p_login IN VARCHAR2,
										p_file_name VARCHAR2,
										p_upload_type VARCHAR2,
										p_description VARCHAR2,
										p_qatch_flag VARCHAR2,
										p_data IN BLOB
							) AS
CURSOR LDATA 
is

SELECT
APPLICANT_SCORE_ID,              
BATCH_ID,                      
OBJECT_VERSION_NUM, 
REQUEST_STATUS,
REQUISITION_NUMBER,             
REQUISITION_TITLE,              
REQUISITION_TYPE,               
REQUISITION_STATUS,             
POSITION,                       
SUBMISSION_ID,
APPLICANT_NUMBER,
APPLICANT_NAME,                                
CURRENT_PHASE_NAME,             
CURRENT_STATE_NAME,             
NEW_PHASE_NAME,                 
NEW_STATE_NAME,                 
COMMENTS,     
CREATED_BY,
CREATION_DATE,                  
LAST_UPDATED_BY,                
LAST_UPDATE_DATE,               
LAST_UPDATE_LOGIN,
NEW_PHASE_ID,
NEW_STATE_ID ,
ACTIVE_FLAG ,
ERROR_MSG

FROM
    JSON_TABLE ( p_data FORMAT JSON, '$.parts[*]'
        COLUMNS (
            applicant_score_id                  NUMBER           PATH '$.applicant_score_id',
            batch_id                           NUMBER           PATH '$.batch_id',
            object_version_num                 NUMBER            PATH '$.object_version_num',
             request_status                 VARCHAR2(260)    PATH '$.request_status',
            requisition_number                 NUMBER          PATH '$.requisition_number',
            requisition_title                  VARCHAR2(260)    PATH '$.requisition_title',
            requisition_type                   VARCHAR2(260)    PATH '$.requisition_type',
            requisition_status                 VARCHAR2(260)    PATH '$.requisition_status',
            position                           VARCHAR2(260)    PATH '$.position',
            submission_id                      NUMBER          PATH '$.submission_id',
            applicant_number                   NUMBER          PATH '$.applicant_number',
            applicant_name                     VARCHAR2(260)    PATH '$.applicant_name',
            current_phase_name                 VARCHAR2(260)    PATH '$.current_phase_name',
            current_state_name                 VARCHAR2(260)    PATH '$.current_state_name',
            new_phase_name                     VARCHAR2(260)    PATH '$.new_phase_name',
            new_state_name                     VARCHAR2(260)    PATH '$.new_state_name',
            comments                           VARCHAR2(260)    PATH '$.comments',
			created_by                         VARCHAR2(260)    PATH '$.created_by',      
            creation_date                      TIMESTAMP(6)    PATH '$.creation_date',
            last_updated_by                    VARCHAR2(260)    PATH '$.last_updated_by',
            last_update_date                   TIMESTAMP(6)    PATH '$.last_update_date',
            last_update_login                  VARCHAR2(260)    PATH '$.last_update_login',
			new_phase_id                      NUMBER          PATH '$.new_phase_id',
			new_state_id                      NUMBER          PATH '$.new_state_id',
			active_flag                       VARCHAR2(1)    PATH '$.active_flag',
            error_msg                       VARCHAR2(2000)    PATH '$.error_msg'
        )
    );

cursor stage_data(p_batch_id number)
is 
SELECT * FROM FS_APPLICANT_SCOREMASS_UPLOAD_STG
where 
ACTIVE_FLAG='Y'
and BATCH_ID=p_batch_id
;


    -- Declare variables
   l_seq_id   NUMBER := BATCH_ID_S.NEXTVAL;
    l_count NUMBER := 0;
    lstateid NUMBER;
    lphaseid NUMBER;
   l_flag VARCHAR2(260) := 'Y';
 -- lrowcount number:=0; 
--    lrowcount number:=APPLICANT_SCORE_STG_S.NEXTVAL; 
     p_err_msg varchar2(1500);
     p_err_code varchar2(30);
     p_tx_number varchar2(30);
      p_error_log varchar2(2000);


BEGIN
   -- Insert data into STG
    FOR i IN LDATA
    LOOP
  -- lrowcount:=l_seq_id||lrowcount;

     BEGIN
        SELECT STATE_ID INTO lstateid
        FROM FS_APPLICANT_STATENAME_T
         where   (REGEXP_REPLACE(STATE_NAME, '[^0-9A-Za-z]', '')) =  (REGEXP_REPLACE(i.new_state_name, '[^0-9A-Za-z]', ''));
       l_flag := 'Y';
    EXCEPTION
        WHEN OTHERS THEN
            l_flag := 'E';
            p_error_log:='Invalid State Name';
    END;
    -- Get phase_id
    BEGIN
        SELECT PHASE_ID INTO lphaseid
        FROM FS_APPLICANT_PHASENAME_T
         where   (REGEXP_REPLACE(PHASE_NAME, '[^0-9A-Za-z]', '')) =  (REGEXP_REPLACE(i.new_phase_name, '[^0-9A-Za-z]', ''));
      l_flag := 'Y';
    EXCEPTION
        WHEN OTHERS THEN
            l_flag := l_flag|| 'E';
            p_error_log:=p_error_log||' Invalid Phase Name';
    END;
--insert call for stg    
        INSERT INTO FS_APPLICANT_SCOREMASS_UPLOAD_STG (
           -- applicant_score_id,
            batch_id,
            object_version_num,
            request_status,
            requisition_number,
            requisition_title,
            requisition_type,
            requisition_status,
            position,
            submission_id,
            applicant_number,
            applicant_name,
            current_phase_name,
            current_state_name,
            new_phase_name,
            new_state_name,
            comments,
            created_by,
            creation_date,
            last_updated_by,
            last_update_date,
            last_update_login,
            new_phase_id,
            new_state_id,
            active_flag,
            error_msg
        ) VALUES (
          --  lrowcount,
            l_seq_id,
            0,
            'Draft',
            i.requisition_number,
            i.requisition_title,
            i.requisition_type,
            i.requisition_status,
            i.position,
            i.submission_id,
            i.applicant_number,
            i.applicant_name,
            i.current_phase_name,
            i.current_state_name,
            i.new_phase_name,
            i.new_state_name,
            i.comments,
            p_login,
            SYSDATE,
            p_login,
            SYSDATE,
            p_login,
            lphaseid,
            lstateid,
            l_flag,
            p_error_log
        );
        COMMIT;

lstateid:=null;
lphaseid:=null;
--lrowcount:=lrowcount+1;

    END LOOP;

    -- Check the count of records with active_flag != 'Y'
    SELECT COUNT(*)
    INTO l_count
    FROM SCOREMASS_STG
    WHERE 
    BATCH_ID=l_seq_id
    and upper(active_flag)='EE';

    -- Insert data into FS_EXCEL_UPLOAD_HEADER_T if count is 0
IF l_count = 0 THEN

     INSERT INTO FS_EXCEL_UPLOAD_HEADER_T (
            batch_id,
            batch_number,
            object_version_num,
            batch_date,
            excel_upload_type,
            request_data,
            description,
            request_status,
            active,
            created_by,
            creation_date,
            last_updated_by,
            last_update_date,
            last_update_login
        ) VALUES (
            l_seq_id,
            'REQ-' || l_seq_id,
            0,
            SYSDATE,
            p_upload_type,
            '',
            p_description,
            'Draft',
            p_qatch_flag,
            p_login,
            SYSDATE,
            p_login,
            SYSDATE,
            p_login
        );
        COMMIT;

----       
for i in stage_data(l_seq_id)
loop
    INSERT INTO FS_APPLICANT_SCORE_UPLOAD_T (
    applicant_score_id,              
    batch_id,                      
    object_version_num, 
    request_status,
    requisition_number,             
    requisition_title,              
    requisition_type,               
    requisition_status,             
    position,                       
    submission_id,
    applicant_number,
    applicant_name,                                
    current_phase_name,             
    current_state_name,             
    new_phase_name,                 
    new_state_name,                 
    comments,     
    created_by,
    creation_date,                  
    last_updated_by,                
    last_update_date,               
    last_update_login,
    NEW_PHASE_ID,
    NEW_STATE_ID
    ) VALUES (
        APPLICANT_SCORE_ID_S.nextval,
        l_seq_id,
        0,
        'Draft',
    i.requisition_number,             
    i.requisition_title,              
    i.requisition_type,               
    i.requisition_status,             
    i.position,                       
    i.submission_id, 
    i.applicant_number,
    i.applicant_name,                               
    i.current_phase_name,             
    i.current_state_name,             
    i.new_phase_name,                 
    i.new_state_name,                 
    i.comments,
    p_login,
    sysdate,
    p_login,
    sysdate,
    p_login,
    i.NEW_PHASE_ID,
    i.NEW_STATE_ID
);
commit;
end loop;



     p_err_msg:='Success';
     p_err_code:='S';
     p_tx_number:='REQ-'||l_seq_id;
else

     p_err_msg:='Error in File upload.';
     p_err_code:='E';
     p_tx_number:='0';
END IF;

    -- APEX_JSON code here...
     APEX_JSON.open_object;
     APEX_JSON.write ('p_err_msg', p_err_msg);
     APEX_JSON.write ('p_err_code', p_err_code);
    APEX_JSON.write ( 'transactionNum', p_tx_number);
    APEX_JSON.write ( 'p_batch_id', l_seq_id);
  APEX_JSON.close_object;

EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE(SQLERRM);
        -- Handle exceptions here...
        APEX_JSON.open_object;
       APEX_JSON.write ('p_err_msg', p_err_msg);
     APEX_JSON.write ('p_err_code', p_err_code);
    APEX_JSON.write ( 'transactionNum', p_tx_number);
    APEX_JSON.write ( 'p_batch_id', l_seq_id);
        APEX_JSON.close_object;
END UPLOAD_PRO;
