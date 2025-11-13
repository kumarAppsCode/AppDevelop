define([
  'vb/action/actionChain',
  'vb/action/actions',
  'vb/action/actionUtils',
], (
  ActionChain,
  Actions,
  ActionUtils
) => {
  'use strict';
  
  class onClickDownload extends ActionChain {
    /**
     * @param {Object} context
     * @param {Object} params
     * @param {any} params.P_BATCH_ID
     */
    async run(context, { P_BATCH_ID }) {
      const { $page, $flow, $application, $constants, $variables } = context;
      
      try {
        console.log("=== STARTING GL JOURNAL ENTRY EXPORT ===");
        console.log(`Batch ID: ${P_BATCH_ID}`);
        
        // ====================================================================
        // STEP 1: DEFINE COLUMN CONFIGURATION WITH DATA TYPES
        // EACH COLUMN INCLUDES dataType PROPERTY FOR AUTOMATIC HANDLING
        // ====================================================================
        const columnConfig = [
          // ID & Reference Fields (TEXT)
          { headerText: "Batch ID", field: "batch_id", width: 12, dataType: "text" },
          { headerText: "GL Line ID", field: "gl_line_id", width: 14, dataType: "text" },
          
          // Description Fields (TEXT)
          { headerText: "Ledger Name", field: "ledger_name", width: 18, dataType: "text" },
          { headerText: "Status", field: "status", width: 12, dataType: "text" },
          { headerText: "Ledger ID", field: "ledger_id", width: 16, dataType: "text" },
          
          // JE Fields (TEXT)
          { headerText: "JE Source", field: "je_source_name", width: 16, dataType: "text" },
          { headerText: "User JE Source Name", field: "user_je_source_name", width: 16, dataType: "text" },
          { headerText: "JE Category", field: "je_category_name", width: 18, dataType: "text" },
          { headerText: "User JE Category Name", field: "user_je_category_name", width: 16, dataType: "text" },
          
          // Currency & Date Fields
          { headerText: "Currency", field: "currency_code", width: 10, dataType: "text" },
          { headerText: "Accounting Date", field: "accounting_date", width: 16, dataType: "date" },
          { headerText: "Date Created", field: "date_created", width: 16, dataType: "date" },
          
          // Flag Fields (TEXT)
          { headerText: "Actual Flag", field: "actual_flag", width: 11, dataType: "text" },
          
          // ===================================================================
          // SEGMENT FIELDS - CRITICAL: ALWAYS TEXT (prevent "000" → 0.00)
          // ===================================================================
          { headerText: "Segment 1", field: "segment1", width: 11, dataType: "text" },
          { headerText: "Segment 2", field: "segment2", width: 11, dataType: "text" },
          { headerText: "Segment 3", field: "segment3", width: 11, dataType: "text" },
          { headerText: "Segment 4", field: "segment4", width: 11, dataType: "text" },
          { headerText: "Segment 5", field: "segment5", width: 11, dataType: "text" },
          { headerText: "Segment 6", field: "segment6", width: 11, dataType: "text" },
          { headerText: "Segment 7", field: "segment7", width: 11, dataType: "text" },
          { headerText: "Segment 8", field: "segment8", width: 11, dataType: "text" },
          { headerText: "Segment 9", field: "segment9", width: 11, dataType: "text" },
          
          // ===================================================================
          // CURRENCY FIELDS - NUMERIC WITH 2 DECIMAL PLACES
          // ===================================================================
          { headerText: "Entered DR", field: "entered_dr", width: 13, dataType: "currency" },
          { headerText: "Entered CR", field: "entered_cr", width: 13, dataType: "currency" },
          
          // Reference Fields (TEXT)
          { headerText: "Reference 1", field: "reference1", width: 20, dataType: "text" },
          { headerText: "Reference 4", field: "reference4", width: 20, dataType: "text" },
          { headerText: "Reference 10", field: "reference10", width: 22, dataType: "text" }
        ];
        
        console.log(`Column Configuration Loaded: ${columnConfig.length} columns`);
        
        // ====================================================================
        // STEP 2: GET TOTAL COUNT
        // ====================================================================
        console.log("\nStep 2: Getting total count...");
        
        if (!$variables.searchLineObj) {
          throw new Error("searchLineObj variable not found in $variables");
        }
        
        $variables.searchLineObj.IN_LIMIT = "10";
        $variables.searchLineObj.IN_OFFSET = "0";
        $variables.searchLineObj.P_BATCH_ID = P_BATCH_ID;
        
        const countResponse = await Actions.callRest(context, {
          endpoint: 'ORDSRH/postDetailSearch',
          body: $variables.searchLineObj,
        });
        
        const totalCount = parseInt(countResponse.body.OUT_TOTAL_COUNT || 0);
        console.log(`Total records available: ${totalCount}`);
        
        if (totalCount === 0) {
          await Actions.fireNotificationEvent(context, {
            summary: 'No Records',
            message: 'No GL journal entry details found to export for this batch',
            type: 'info',
            displayMode: 'transient'
          });
          
          $variables.searchLineObj.IN_LIMIT = "";
          $variables.searchLineObj.IN_OFFSET = "";
          $variables.searchLineObj.P_BATCH_ID = "";
          
          return [];
        }
        
        // ====================================================================
        // STEP 3: CALCULATE BATCHES
        // ====================================================================
        let batchSize;
        if (totalCount <= 1000) {
          batchSize = 500;
        } else if (totalCount <= 10000) {
          batchSize = 250;
        } else if (totalCount <= 50000) {
          batchSize = 200;
        } else {
          batchSize = 150;
        }
        
        const totalBatches = Math.ceil(totalCount / batchSize);
        
        console.log(`\nExport Plan:`);
        console.log(`- Total Records: ${totalCount}`);
        console.log(`- Batch Size: ${batchSize} (Auto-optimized)`);
        console.log(`- Batches Needed: ${totalBatches}`);
        
        // ====================================================================
        // STEP 4: FETCH ALL DATA IN BATCHES
        // ====================================================================
        let consolidatedResults = [];
        let failedBatches = [];
        
        for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
          
          if (consolidatedResults.length >= totalCount) {
            console.log(`✓ Already have ${consolidatedResults.length} records, stopping...`);
            break;
          }
          
          const currentOffset = batchNumber * batchSize;
          const remainingRecords = totalCount - consolidatedResults.length;
          const recordsToFetch = Math.min(batchSize, remainingRecords);
          
          console.log(`\n[Batch ${batchNumber + 1}/${totalBatches}] Offset: ${currentOffset}, Fetching: ${recordsToFetch}`);
          
          try {
            $variables.searchLineObj.IN_LIMIT = recordsToFetch.toString();
            $variables.searchLineObj.IN_OFFSET = currentOffset.toString();
            $variables.searchLineObj.P_BATCH_ID = P_BATCH_ID;
            
            const batchResponse = await Actions.callRest(context, {
              endpoint: 'ORDSRH/postDetailSearch',
              body: $variables.searchLineObj,
            });
            
            const fetchedCount = batchResponse.body.OUT_COUNT || 0;
            console.log(`Fetched: ${fetchedCount} records`);
            
            if (fetchedCount > 0 && batchResponse.body.P_OUTPUT) {
              
              const filteredRecords = batchResponse.body.P_OUTPUT.map(record => {
                let mappedRecord = {};
                columnConfig.forEach(col => {
                  mappedRecord[col.field] = record[col.field] || "";
                });
                return mappedRecord;
              });
              
              const recordsToAdd = filteredRecords.slice(0, remainingRecords);
              consolidatedResults = consolidatedResults.concat(recordsToAdd);
              
              const progress = Math.round((consolidatedResults.length / totalCount) * 100);
              console.log(`Progress: ${consolidatedResults.length}/${totalCount} (${progress}%)`);
            }
            
          } catch (batchError) {
            console.error(`✗ Batch ${batchNumber + 1} failed:`, batchError);
            failedBatches.push(batchNumber + 1);
            
            if (failedBatches.length <= 3) {
              console.log(`Continuing with remaining batches...`);
            } else {
              throw new Error(`Too many batch failures (${failedBatches.length}). Aborting export.`);
            }
          }
          
          if (consolidatedResults.length >= totalCount) {
            console.log(`✓ Reached target count (${totalCount}), stopping...`);
            break;
          }
        }
        
        if (consolidatedResults.length > totalCount) {
          console.warn(`⚠️ Got ${consolidatedResults.length} records, trimming to ${totalCount}`);
          consolidatedResults = consolidatedResults.slice(0, totalCount);
        }
        
        // ====================================================================
        // STEP 5: VERIFY COUNT
        // ====================================================================
        console.log("\n=== DATA FETCH COMPLETED ===");
        console.log(`Expected: ${totalCount} records`);
        console.log(`Fetched: ${consolidatedResults.length} records`);
        console.log(`Match: ${totalCount === consolidatedResults.length ? 'YES ✓' : 'NO ✗'}`);
        
        if (failedBatches.length > 0) {
          console.warn(`⚠️ Failed batches: ${failedBatches.join(', ')}`);
        }
        
        // ====================================================================
        // STEP 6: GENERATE EXCEL FILE WITH AUTOMATIC DATA TYPE HANDLING
        // Uses dataType property from each column in columnConfig
        // ====================================================================
        console.log("\nStep 6: Generating Excel file with automatic data type handling...");
        
        // Create header row
        let xlsHeader = [];
        columnConfig.forEach(col => {
          xlsHeader.push(col.headerText);
        });
        
        // Create data array with headers
        let createXLSFormatObj = [];
        createXLSFormatObj.push(xlsHeader);
        
        consolidatedResults.forEach(value => {
          let innerRowData = [];
          columnConfig.forEach(col => {
            innerRowData.push(value[col.field]);
          });
          createXLSFormatObj.push(innerRowData);
        });
        
        // Create workbook and worksheet
        let wb = XLSX.utils.book_new();
        let ws = XLSX.utils.aoa_to_sheet(createXLSFormatObj);
        
        // ================================================================
        // AUTOMATIC DATA TYPE FORMATTING
        // Iterates through columnConfig and applies type formatting
        // based on dataType property - NO hardcoded indices needed
        // ================================================================
        console.log(`\n📊 Applying data types to Excel cells...`);
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Create mapping of column index to data type from columnConfig
        const columnTypeMap = {};
        columnConfig.forEach((col, index) => {
          columnTypeMap[index] = col.dataType;
        });
        
        console.log(`Column Type Mapping (dynamic from columnConfig):`);
        columnConfig.forEach((col, index) => {
          if (col.dataType !== 'auto') {
            console.log(`  [${index}] ${col.headerText} → ${col.dataType}`);
          }
        });
        
        // Format all cells according to their column's dataType
        for (let row = 1; row <= range.e.r; row++) {
          
          for (let col = 0; col <= range.e.c; col++) {
            
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cellDataType = columnTypeMap[col];
            
            if (!ws[cellAddress]) continue;
            
            const cellValue = ws[cellAddress].v;
            if (cellValue === null || cellValue === "") continue;
            
            // Apply formatting based on dataType
            switch (cellDataType) {
              
              case 'text':
                ws[cellAddress].t = 's';                    // String type
                ws[cellAddress].v = String(cellValue);      // Ensure string
                ws[cellAddress].z = undefined;              // No format codes
                break;
              
              case 'currency':
                ws[cellAddress].t = 'n';                    // Number type
                ws[cellAddress].z = '#,##0.00';             // Currency format
                break;
              
              case 'date':
                ws[cellAddress].t = 'd';                    // Date type
                ws[cellAddress].z = 'dd-mmm-yyyy';          // Date format
                break;
              
              case 'integer':
                ws[cellAddress].t = 'n';                    // Number type
                ws[cellAddress].z = '0';                    // Integer format
                break;
              
              case 'percentage':
                ws[cellAddress].t = 'n';                    // Number type
                ws[cellAddress].z = '0.00%';                // Percentage format
                break;
              
              case 'auto':
              default:
                // Let XLSX handle naturally
                break;
            }
          }
        }
        
        // Count formatted columns by type
        const typeStats = {
          text: 0,
          currency: 0,
          date: 0,
          integer: 0,
          percentage: 0,
          auto: 0
        };
        
        columnConfig.forEach(col => {
          if (typeStats.hasOwnProperty(col.dataType)) {
            typeStats[col.dataType]++;
          }
        });
        
        console.log(`\n✓ Data type formatting applied`);
        console.log(`📈 Formatting Summary:`);
        console.log(`  - Text: ${typeStats.text} cols (type 's', prevent "000" → 0.00) ✅`);
        console.log(`  - Currency: ${typeStats.currency} cols (type 'n', #,##0.00)`);
        console.log(`  - Date: ${typeStats.date} cols (type 'd', dd-mmm-yyyy)`);
        console.log(`  - Integer: ${typeStats.integer} cols (type 'n', whole numbers)`);
        console.log(`  - Percentage: ${typeStats.percentage} cols (type 'n', percentage)`);
        console.log(`  - Auto: ${typeStats.auto} cols (XLSX auto-detect)`);
        
        // Set column widths
        let colWidths = [];
        columnConfig.forEach(col => {
          colWidths.push({ width: col.width });
        });
        ws['!cols'] = colWidths;
        
        // Freeze header row
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        
        // Download file
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        let filename = `GLJournalEntry_Batch_${P_BATCH_ID}_${dateStr}.xlsx`;
        let ws_name = "GL Journal Entries";
        
        XLSX.utils.book_append_sheet(wb, ws, ws_name);
        XLSX.writeFile(wb, filename);
        
        console.log(`✓ Excel file "${filename}" downloaded successfully!`);
        
        // ====================================================================
        // STEP 7: CLEANUP AND NOTIFICATION
        // ====================================================================
        console.log("\nStep 7: Cleanup and notification...");
        
        $variables.searchLineObj.IN_LIMIT = "";
        $variables.searchLineObj.IN_OFFSET = "";
        $variables.searchLineObj.P_BATCH_ID = "";
        
        await Actions.fireNotificationEvent(context, {
          summary: 'Export Successful',
          message: `Successfully exported ${consolidatedResults.length} GL journal entry records to Excel (Batch: ${P_BATCH_ID})`,
          type: 'confirmation',
          displayMode: 'transient'
        });
        
        console.log("=== EXPORT COMPLETED SUCCESSFULLY ===\n");
        
        return consolidatedResults;
        
      } catch (error) {
        console.error("=== EXPORT FAILED ===");
        console.error("Error:", error);
        console.error("Stack:", error.stack);
        
        $variables.searchLineObj.IN_LIMIT = "";
        $variables.searchLineObj.IN_OFFSET = "";
        $variables.searchLineObj.P_BATCH_ID = "";
        
        await Actions.fireNotificationEvent(context, {
          summary: 'Export Failed',
          message: error.message || 'An error occurred during export. Check console for details.',
          type: 'error',
          displayMode: 'transient'
        });
        
        return [];
      }
    }
  }
  
  return onClickDownload;
});
