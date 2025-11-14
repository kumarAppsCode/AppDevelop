            lv_where := lv_where || ' AND UPPER(oris_ref_number) LIKE ''%' || UPPER(TRIM(p_oris_ref_number)) || '%''';
