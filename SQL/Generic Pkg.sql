DECLARE
   l_tab_name   VARCHAR2 (30) := 'PS_SALE_BOOKING_CHARGE_T';
   l_pkg_name   VARCHAR2 (30);
   l_val_1      VARCHAR2 (4000);
   l_val_2      VARCHAR2 (4000);
   l_val_3      VARCHAR2 (4000);
   l_val_4      VARCHAR2 (4000);
   l_val_5      VARCHAR2 (4000);
   l_val_6      VARCHAR2 (4000);
   l_txt_1      VARCHAR2 (4000);
   l_txt_2      VARCHAR2 (4000);
   l_txt_3      VARCHAR2 (4000);
   l_txt_4      VARCHAR2 (4000);
BEGIN
   l_pkg_name      :=    RTRIM (l_tab_name
                               ,'_T')
                      || '_PKG';

   l_val_1         :=    'CREATE OR REPLACE PACKAGE '
                      || l_pkg_name
                      || ' IS 
                           PROCEDURE process_data (p_method       IN VARCHAR2
                                                  ,p_primarykey   IN NUMBER
                                                  ,p_data         IN BLOB);
                           PROCEDURE post_data (p_primarykey   IN NUMBER
                                               ,p_data         IN BLOB);
                           PROCEDURE put_data (p_primarykey   IN NUMBER
                                              ,p_data         IN BLOB);
                           PROCEDURE delete_data (p_primarykey   IN NUMBER
                                                 ,p_data         IN BLOB);
                           END '
                      || l_pkg_name
                      || ';';
   DBMS_OUTPUT.put_line (l_val_1);
   DBMS_OUTPUT.put_line ('/');
   l_val_1         := NULL;
   l_txt_1         := 'OPEN cur_data (p_data); FETCH cur_data INTO rec_data; CLOSE cur_data;';
   l_txt_2         := '/*BEGIN
                            SELECT json_query (p_data format json,''$.attribute_json[*]'') clobdata INTO l_attribute_json FROM DUAL;
                       END;*/';
   l_txt_3         := 'COMMIT;
                       l_err_code     := ''S'';
                       l_err_msg      := ''Information Saved Successfully'';
                       apex_json.open_object;
                       apex_json.write (''p_err_code'',l_err_code);
                       apex_json.write (''p_err_msg'',l_err_msg);
                       apex_json.write (''p_primarykey'',l_primarykey);
                       apex_json.close_object;';
   l_txt_4         := 'EXCEPTION
                              WHEN OTHERS THEN
                                 l_err_code   := ''E'';
                                 l_err_msg    := ''API Error - '' || SQLERRM;
                                 DBMS_OUTPUT.put_line (''Error > '' || SQLCODE || SQLERRM);
                                 apex_json.open_object;
                                 apex_json.write (''p_err_code'',l_err_code);
                                 apex_json.write (''p_err_msg'',l_err_msg);
                                 apex_json.write (''p_primarykey'',l_primarykey);
                                 apex_json.close_object;';

   FOR i IN (  SELECT column_id
                     ,LOWER (column_name) column_name
                     ,CASE WHEN data_type = 'TIMESTAMP(6)' THEN 'TIMESTAMP' ELSE data_type END data_type
                 FROM user_tab_columns xyz
                WHERE table_name = l_tab_name
             ORDER BY column_id)
   LOOP
      IF i.column_id = 1 THEN
         l_val_1   := i.column_name;
         l_val_2   := i.column_name || ' ' || i.data_type || ' PATH ''$.' || i.column_name || '''';
         l_val_3   := 'l_seq_id';
         l_val_4   := 'WHERE ' || i.column_name || '=' || 'rec_data.' || i.column_name || ';';
         l_val_6   := 'rec_data.' || i.column_name || ';';
      ELSE
         l_val_1   := l_val_1 || ',' || i.column_name;
         l_val_2   := l_val_2 || CHR (10) || ',' || i.column_name || ' ' || i.data_type || ' PATH ''$.' || i.column_name || '''';
         l_val_3   := l_val_3 || ',rec_data.' || i.column_name;

         IF i.column_id = 2 THEN
            l_val_5   := i.column_name || '=' || 'rec_data.' || i.column_name;
         ELSE
            l_val_5   := l_val_5 || ',' || i.column_name || '=' || 'rec_data.' || i.column_name;
         END IF;
      END IF;
   END LOOP;

   DBMS_OUTPUT.put_line (
      'CREATE OR REPLACE PACKAGE BODY ' || l_pkg_name || ' IS CURSOR cur_data (p_data BLOB) IS SELECT 1 FROM DUAL; /* SELECT ');
   DBMS_OUTPUT.put_line (l_val_1);
   DBMS_OUTPUT.put_line (' FROM json_table ( p_data FORMAT JSON, ''$'' COLUMNS (');
   DBMS_OUTPUT.put_line (l_val_2);
   DBMS_OUTPUT.put_line ('));*/');
   DBMS_OUTPUT.put_line ('rec_data cur_data%ROWTYPE;');
   DBMS_OUTPUT.put_line ('l_err_code VARCHAR2 (1);');
   DBMS_OUTPUT.put_line ('l_err_msg VARCHAR2 (2000);');
   DBMS_OUTPUT.put_line ('l_primarykey NUMBER;');
   DBMS_OUTPUT.put_line ('l_attribute_json ' || l_tab_name || '.attribute_json%TYPE;');
   DBMS_OUTPUT.put_line (
      'PROCEDURE process_data (p_method IN VARCHAR2,p_primarykey IN NUMBER,p_data IN BLOB)
   IS BEGIN IF p_method = ''POST'' THEN post_data (p_primarykey,p_data); ELSIF p_method = ''PUT'' THEN put_data (p_primarykey
   ,p_data); ELSIF p_method = ''DELETE'' THEN delete_data (p_primarykey,p_data); END IF; END process_data;');
   DBMS_OUTPUT.put_line ('PROCEDURE post_data (p_primarykey IN NUMBER ,p_data IN BLOB) IS
      l_seq_id   NUMBER := ps_transaction_id_s.NEXTVAL; BEGIN ');
   DBMS_OUTPUT.put_line (l_txt_1);
   DBMS_OUTPUT.put_line (l_txt_2);
   DBMS_OUTPUT.put_line ('INSERT INTO ' || l_tab_name || '(');
   DBMS_OUTPUT.put_line (l_val_1 || ')');
   DBMS_OUTPUT.put_line ('VALUES (');
   DBMS_OUTPUT.put_line (l_val_3 || ');');
   DBMS_OUTPUT.put_line ('l_primarykey   := l_seq_id;');
   DBMS_OUTPUT.put_line (l_txt_3);
   DBMS_OUTPUT.put_line (l_txt_4);
   DBMS_OUTPUT.put_line ('END post_data;');
   DBMS_OUTPUT.put_line ('PROCEDURE put_data (p_primarykey IN NUMBER,p_data IN BLOB) IS BEGIN ');
   DBMS_OUTPUT.put_line (l_txt_1);
   DBMS_OUTPUT.put_line (l_txt_2);
   DBMS_OUTPUT.put_line ('UPDATE ' || l_tab_name || ' SET ');
   DBMS_OUTPUT.put_line (l_val_5);
   DBMS_OUTPUT.put_line (l_val_4);
   DBMS_OUTPUT.put_line ('l_primarykey:= ' || l_val_6);
   DBMS_OUTPUT.put_line (l_txt_3);
   DBMS_OUTPUT.put_line (l_txt_4);
   DBMS_OUTPUT.put_line ('END put_data;');
   DBMS_OUTPUT.put_line ('PROCEDURE delete_data (p_primarykey IN NUMBER ,p_data IN BLOB) IS BEGIN ');
   DBMS_OUTPUT.put_line (l_txt_1);
   DBMS_OUTPUT.put_line ('DELETE FROM ' || l_tab_name || ' ' || l_val_4);
   DBMS_OUTPUT.put_line ('l_primarykey:= ' || l_val_6);
   DBMS_OUTPUT.put_line (l_txt_3);
   DBMS_OUTPUT.put_line (l_txt_4);
   DBMS_OUTPUT.put_line ('END delete_data;');
   DBMS_OUTPUT.put_line ('END ' || l_pkg_name || ';');
END;
