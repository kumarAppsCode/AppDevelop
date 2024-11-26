create or replace PACKAGE fs_nws_report_access_pkg IS
    PROCEDURE process_data (
        p_method     	IN VARCHAR2,
        p_primarykey 	IN VARCHAR2,
        p_data       	IN BLOB,
        p_err_code   	OUT VARCHAR2,
        p_err_msg    	OUT VARCHAR2,
        p_updated_key 	OUT VARCHAR2
    );

    PROCEDURE post_data (
        p_primarykey IN VARCHAR2,
        p_data       IN BLOB,
        p_err_code   OUT VARCHAR2,
        p_err_msg    OUT VARCHAR2,
        p_updated_key 	OUT VARCHAR2
    );

    PROCEDURE put_data (
        p_primarykey IN VARCHAR2,
        p_data       IN BLOB,
        p_err_code   OUT VARCHAR2,
        p_err_msg    OUT VARCHAR2,
        p_updated_key 	OUT VARCHAR2
    );

    PROCEDURE delete_data (
        p_primarykey IN VARCHAR2,
        p_data       IN BLOB,
        p_err_code   OUT VARCHAR2,
        p_err_msg    OUT VARCHAR2
    );

END fs_nws_report_access_pkg;



/


create or replace PACKAGE BODY fs_nws_report_access_pkg 
IS

  -- Internal variables
    l_err_code          VARCHAR2(1);
    l_err_msg           VARCHAR2(2000);
    l_primarykey        VARCHAR2(250);
    p_decypt_data       VARCHAR2(4000);
    enc_payload         VARCHAR2(4000);
    p_encypt_status     VARCHAR2(60):='SUCCESS';



  -- Main Process Procedure
  PROCEDURE process_data (
      p_method     			IN VARCHAR2,
      p_primarykey 			IN VARCHAR2,
      p_data       			IN BLOB,
      p_err_code   			OUT VARCHAR2,
      p_err_msg    			OUT VARCHAR2,
      p_updated_key 		OUT VARCHAR2
  ) IS
  BEGIN
    IF p_method = 'POST' THEN
      post_data(p_primarykey, p_data, p_err_code, p_err_msg , p_updated_key);
    ELSIF p_method = 'PUT' THEN
      put_data(p_primarykey, p_data, p_err_code, p_err_msg, p_updated_key);
    ELSIF p_method = 'DELETE' THEN
      delete_data(p_primarykey, p_data, p_err_code, p_err_msg);
    NULL;
    END IF;
  END process_data;

  -- Post Data Procedure
  PROCEDURE post_data (
      p_primarykey 			IN VARCHAR2,
      p_data       			IN BLOB,
      p_err_code   			OUT VARCHAR2,
      p_err_msg    			OUT VARCHAR2,
      p_updated_key 		OUT VARCHAR2
  ) IS
    l_seq_id            NUMBER := EMPLOYEE_SHIFT_ID_S.nextval;
    lrandom             VARCHAR2(250);

  BEGIN
--get enc payload
    BEGIN
        SELECT JSON_VALUE(UTL_RAW.CAST_TO_VARCHAR2(p_data), '$.payload')
        INTO enc_payload
        FROM DUAL;
    exception when others THEN
        enc_payload:=null;
    END;
--get decode payload
   begin
        select 
           fs_decrypt_data(enc_payload)
           into p_decypt_data
        from dual;
   exception when others THEN
        p_decypt_data:=UTL_RAW.CAST_TO_RAW('Error');
        p_encypt_status:='ERROR';
   end;

if(upper(p_encypt_status)!='ERROR') then 
    --DBMS_OUTPUT.PUT_LINE('report_access_id>>' || p_decypt_data);
    --DBMS_OUTPUT.PUT_LINE('report_access_id = ' || JSON_VALUE(p_decypt_data, '$.report_access_id'));
    -- Random Number    
    BEGIN
            SELECT
                dbms_random.string('a', 5)
                || floor(dbms_random.value(100000, 999999))
                || dbms_random.string('U', 3) AS random_code
            INTO lrandom
            FROM
            dual;
        EXCEPTION
            WHEN OTHERS THEN
                lrandom := NULL;
        END;
-- Random Number  End  

    INSERT INTO fs_nws_report_access_t (
        report_access_id,
        report_code,
        person_id,
        person_name,
        person_number,
        status,
        creation_date,
        created_by,
        last_updated_by,
        last_update_date,
        last_update_login,
        source_ref_id
    ) VALUES (
        l_seq_id,
        JSON_VALUE(p_decypt_data, '$.report_code'),
        JSON_VALUE(p_decypt_data, '$.person_id'),
        JSON_VALUE(p_decypt_data, '$.person_name'),
        JSON_VALUE(p_decypt_data, '$.person_number'),
        JSON_VALUE(p_decypt_data, '$.status'),
        sysdate,
        JSON_VALUE(p_decypt_data, '$.created_by'),
        JSON_VALUE(p_decypt_data, '$.last_updated_by'),
        sysdate,
        JSON_VALUE(p_decypt_data, '$.last_update_login'),
        lrandom
    );
--      l_primarykey := l_seq_id;
        l_primarykey := lrandom;

    COMMIT;

    p_err_code := 'S';
    p_err_msg := 'Information Saved Successfully';
    p_updated_key := l_primarykey;
else
    p_err_code := 'E' ;
    p_err_msg := 'Invalid Payload' ||SQLERRM;
    p_updated_key := 0;
end if;

  EXCEPTION
    WHEN OTHERS THEN
      p_err_code := 'E1';
      p_err_msg := 'API Error - ' || SQLERRM;
      p_updated_key := 0;
  END post_data;

  -- Put Data Procedure
  PROCEDURE put_data (
      p_primarykey 		IN VARCHAR2,
      p_data       		IN BLOB,
      p_err_code   		OUT VARCHAR2,
      p_err_msg    		OUT VARCHAR2,
      p_updated_key 	OUT VARCHAR2
  ) IS
  BEGIN
--get enc payload
    BEGIN
        SELECT JSON_VALUE(UTL_RAW.CAST_TO_VARCHAR2(p_data), '$.payload')
        INTO enc_payload
        FROM DUAL;
    exception when others THEN
        enc_payload:=null;
    END;
--get decode payload
   begin
        select 
           fs_decrypt_data(enc_payload)
           into p_decypt_data
        from dual;
   exception when others THEN
        p_decypt_data:=UTL_RAW.CAST_TO_RAW('Error');
        p_encypt_status:='ERROR';
   end;

if(upper(p_encypt_status)!='ERROR') then 

    UPDATE fs_nws_report_access_t
    SET
      status = JSON_VALUE(p_decypt_data, '$.status'),
      last_updated_by = JSON_VALUE(p_decypt_data, '$.last_updated_by'),
      last_update_date = TO_DATE(JSON_VALUE(p_decypt_data, '$.last_update_date'), 'YYYY-MM-DD'),      
      last_update_login = JSON_VALUE(p_decypt_data, '$.last_update_login')      
    WHERE 
    SOURCE_REF_ID=p_primarykey
    and report_access_id=JSON_VALUE(p_decypt_data, '$.report_access_id') ;
    COMMIT;

    p_err_code := 'S';
    p_err_msg := 'Information Updated Successfully'||JSON_VALUE(p_decypt_data, '$.last_update_date');
    p_updated_key := p_primarykey;

else
    p_err_code := 'E' ;
    p_err_msg := 'Invalid Payload';
    p_updated_key := 0;
end if;

  EXCEPTION
    WHEN OTHERS THEN
      p_err_code := 'E';
      p_err_msg := 'API Error - ' || SQLERRM;
      p_updated_key := NULL;
  END put_data;

  -- Delete Data Procedure
  PROCEDURE delete_data (
      p_primarykey IN VARCHAR2,
      p_data       IN BLOB,
      p_err_code   OUT VARCHAR2,
      p_err_msg    OUT VARCHAR2
  ) IS
  BEGIN
    DELETE FROM 
    fs_nws_report_access_t 
    WHERE 
    SOURCE_REF_ID=p_primarykey;
    COMMIT;

    p_err_code := 'S';
    p_err_msg := 'Information Deleted Successfully';

  EXCEPTION
    WHEN OTHERS THEN
      p_err_code := 'E';
      p_err_msg := 'API Error - ' || SQLERRM;
  END delete_data;

END fs_nws_report_access_pkg;
