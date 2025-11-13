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
        // STEP 1: DEFINE COLUMN CONFIGURATION FOR GL DATA
        // ORDER EXACTLY AS PER SQL QUERY (rhx_navan_gl_fbdi_audit_dtl_v)
        // ====================================================================
        const columnConfig = [
          { headerText: "Batch ID", field: "batch_id", width: 12 },
          { headerText: "GL Line ID", field: "gl_line_id", width: 14 },
          { headerText: "Ledger Name", field: "ledger_name", width: 18 },
          { headerText: "Status", field: "status", width: 12 },
          { headerText: "Ledger ID", field: "ledger_id", width: 16 },
          { headerText: "JE Source", field: "je_source_name", width: 16 },
          { headerText: "User JE Source Name", field: "user_je_source_name", width: 16 },
          { headerText: "JE Category", field: "je_category_name", width: 18 },
          { headerText: "User JE Category Name", field: "user_je_category_name", width: 16 },
          { headerText: "Currency", field: "currency_code", width: 10 },
          { headerText: "Accounting Date", field: "accounting_date", width: 16 },
          { headerText: "Date Created", field: "date_created", width: 16 },
          { headerText: "Actual Flag", field: "actual_flag", width: 11 },
          { headerText: "Segment 1", field: "segment1", width: 11 },
          { headerText: "Segment 2", field: "segment2", width: 11 },
          { headerText: "Segment 3", field: "segment3", width: 11 },
          { headerText: "Segment 4", field: "segment4", width: 11 },
          { headerText: "Segment 5", field: "segment5", width: 11 },
          { headerText: "Segment 6", field: "segment6", width: 11 },
          { headerText: "Segment 7", field: "segment7", width: 11 },
          { headerText: "Segment 8", field: "segment8", width: 11 },
          { headerText: "Segment 9", field: "segment9", width: 11 },
          { headerText: "Entered DR", field: "entered_dr", width: 13 },
          { headerText: "Entered CR", field: "entered_cr", width: 13 },
          { headerText: "Reference 1", field: "reference1", width: 20 },
          { headerText: "Reference 4", field: "reference4", width: 20 },
          { headerText: "Reference 10", field: "reference10", width: 22 }
        ];
        
        // ====================================================================
        // STEP 2: GET TOTAL COUNT
        // ====================================================================
        console.log("Step 1: Getting total count...");
        
        // Verify searchLineObj exists
        if (!$variables.searchLineObj) {
          throw new Error("searchLineObj variable not found in $variables");
        }
        
        // Set parameters for initial count request
        $variables.searchLineObj.IN_LIMIT = "10";  // Small limit for count check
        $variables.searchLineObj.IN_OFFSET = "0";
        $variables.searchLineObj.P_BATCH_ID = P_BATCH_ID;
        
        console.log("Count request parameters:", {
          P_BATCH_ID: $variables.searchLineObj.P_BATCH_ID,
          IN_LIMIT: $variables.searchLineObj.IN_LIMIT,
          IN_OFFSET: $variables.searchLineObj.IN_OFFSET
        });
        
        // Call REST service to get count
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
          
          // Reset searchLineObj
          $variables.searchLineObj.IN_LIMIT = "";
          $variables.searchLineObj.IN_OFFSET = "";
          $variables.searchLineObj.P_BATCH_ID = "";
          
          return [];
        }
        
        // ====================================================================
        // STEP 3: CALCULATE BATCHES (DYNAMIC BATCH SIZE BASED ON RECORD COUNT)
        // ====================================================================
        
        // Intelligent batch sizing for performance
        let batchSize;
        if (totalCount <= 1000) {
          batchSize = 500;        // 1-1000: larger batches OK
        } else if (totalCount <= 10000) {
          batchSize = 250;        // 1k-10k: medium batches
        } else if (totalCount <= 50000) {
          batchSize = 200;        // 10k-50k: smaller batches for stability
        } else {
          batchSize = 150;        // 50k+: very conservative batching
        }
        
        const totalBatches = Math.ceil(totalCount / batchSize);
        
        console.log(`\nExport Plan:`);
        console.log(`- Total Records: ${totalCount}`);
        console.log(`- Batch Size: ${batchSize} (Auto-optimized)`);
        console.log(`- Batches Needed: ${totalBatches}`);
        console.log(`\nStarting data fetch...`);
        
        // ====================================================================
        // STEP 4: FETCH ALL DATA IN BATCHES
        // ====================================================================
        let consolidatedResults = [];
        let failedBatches = [];
        
        for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
          
          // Safety check: Stop if we already have enough records
          if (consolidatedResults.length >= totalCount) {
            console.log(`✓ Already have ${consolidatedResults.length} records, stopping...`);
            break;
          }
          
          const currentOffset = batchNumber * batchSize;
          const remainingRecords = totalCount - consolidatedResults.length;
          const recordsToFetch = Math.min(batchSize, remainingRecords);
          
          console.log(`\n[Batch ${batchNumber + 1}/${totalBatches}]`);
          console.log(`Offset: ${currentOffset}, Fetching: ${recordsToFetch} records`);
          
          try {
            // Set batch parameters
            $variables.searchLineObj.IN_LIMIT = recordsToFetch.toString();
            $variables.searchLineObj.IN_OFFSET = currentOffset.toString();
            $variables.searchLineObj.P_BATCH_ID = P_BATCH_ID;
            
            // Call REST service for this batch
            const batchResponse = await Actions.callRest(context, {
              endpoint: 'ORDSRH/postDetailSearch',
              body: $variables.searchLineObj,
            });
            
            const fetchedCount = batchResponse.body.OUT_COUNT || 0;
            console.log(`Fetched: ${fetchedCount} records`);
            
            if (fetchedCount > 0 && batchResponse.body.P_OUTPUT) {
              
              // Map API response to required fields
              const filteredRecords = batchResponse.body.P_OUTPUT.map(record => {
                let mappedRecord = {};
                
                // Map all fields from column configuration
                columnConfig.forEach(col => {
                  mappedRecord[col.field] = record[col.field] || "";
                });
                
                return mappedRecord;
              });
              
              // Only add the records we need
              const recordsToAdd = filteredRecords.slice(0, remainingRecords);
              consolidatedResults = consolidatedResults.concat(recordsToAdd);
              
              const progress = Math.round((consolidatedResults.length / totalCount) * 100);
              console.log(`Added: ${recordsToAdd.length} records`);
              console.log(`Progress: ${consolidatedResults.length}/${totalCount} (${progress}%)`);
            }
            
          } catch (batchError) {
            console.error(`✗ Batch ${batchNumber + 1} failed:`, batchError);
            failedBatches.push(batchNumber + 1);
            
            // Continue with next batch instead of stopping
            if (failedBatches.length <= 3) {
              console.log(`Continuing with remaining batches...`);
            } else {
              throw new Error(`Too many batch failures (${failedBatches.length}). Aborting export.`);
            }
          }
          
          // Additional safety check
          if (consolidatedResults.length >= totalCount) {
            console.log(`✓ Reached target count (${totalCount}), stopping...`);
            break;
          }
        }
        
        // Final safety trim
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
        
        const isMatch = totalCount === consolidatedResults.length;
        console.log(`Match: ${isMatch ? 'YES ✓' : 'NO ✗'}`);
        
        if (failedBatches.length > 0) {
          console.warn(`⚠️ Failed batches: ${failedBatches.join(', ')}`);
        }
        
        // ====================================================================
        // STEP 6: GENERATE EXCEL FILE (WITH HEADERS, NO S.No)
        // CORRECTED VERSION - TEXT TYPE PRESERVATION FOR SEGMENT FIELDS
        // ====================================================================
        console.log("\nGenerating Excel file...");
        
        // Create header row with columns (NO S.No)
        let xlsHeader = [];
        columnConfig.forEach(col => {
          xlsHeader.push(col.headerText);
        });
        
        // Create data array WITH header row
        let createXLSFormatObj = [];
        createXLSFormatObj.push(xlsHeader);  // Add headers as first row
        
        // Add data rows directly (no serial numbers)
        consolidatedResults.forEach(function (value, index) {
          let innerRowData = [];
          
          // Add all column data (NO S.No)
          columnConfig.forEach(col => {
            innerRowData.push(value[col.field]);
          });
          
          createXLSFormatObj.push(innerRowData);
        });
        
        // Create workbook and worksheet
        let wb = XLSX.utils.book_new();
        let ws = XLSX.utils.aoa_to_sheet(createXLSFormatObj);
        
        // ================================================================
        // CRITICAL FIX: EXPLICIT TYPE SETTING FOR SEGMENT FIELDS
        // This prevents XLSX auto-conversion of "000" to 0.00
        // ================================================================
        
        // Define which columns are SEGMENT fields (TEXT/STRING ONLY)
        const segmentFieldIndices = {
          segment1: 13,    // Index position in column array
          segment2: 14,
          segment3: 15,
          segment4: 16,
          segment5: 17,
          segment6: 18,
          segment7: 19,
          segment8: 20,
          segment9: 21,
        };
        
        // Currency column indices
        const enteredDRColIndex = 22;   
        const enteredCRColIndex = 23;   
        
        console.log(`\n📊 Column Type Configuration:`);
        console.log(`- Segment Fields (1-9): indices 13-21 → TEXT type`);
        console.log(`- Entered DR (index 22): NUMBER type → #,##0.00`);
        console.log(`- Entered CR (index 23): NUMBER type → #,##0.00`);
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // ================================================================
        // STEP 6A: FORCE ALL SEGMENT FIELDS AS TEXT TYPE
        // ================================================================
        console.log(`\n✏️ Formatting segment fields as TEXT (preventing auto-conversion)...`);
        
        for (let row = 1; row <= range.e.r; row++) {  // Start from row 1 (skip header at row 0)
          
          // Process ALL segment fields (1-9)
          Object.entries(segmentFieldIndices).forEach(([segmentName, colIndex]) => {
            if (colIndex >= 0) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
              
              if (ws[cellAddress]) {
                // CRITICAL: Explicitly set as TEXT type to prevent auto-conversion
                ws[cellAddress].t = 's';  // 's' = string type in XLSX
                
                // Preserve original value as string
                if (ws[cellAddress].v !== null && ws[cellAddress].v !== "") {
                  ws[cellAddress].v = String(ws[cellAddress].v);
                }
                
                // Remove any number format codes
                ws[cellAddress].z = undefined;
              }
            }
          });
        }
        
        console.log(`✓ All segment fields (1-9) set as TEXT type`);
        
        // ================================================================
        // STEP 6B: FORMAT CURRENCY COLUMNS (Entered DR/CR)
        // ================================================================
        console.log(`\n💰 Formatting currency columns as NUMBERS...`);
        
        for (let row = 1; row <= range.e.r; row++) {  // Start from row 1 (skip header at row 0)
          
          if (enteredDRColIndex >= 0) {
            const drCellAddress = XLSX.utils.encode_cell({ r: row, c: enteredDRColIndex });
            if (ws[drCellAddress] && ws[drCellAddress].v !== null && ws[drCellAddress].v !== "") {
              ws[drCellAddress].t = 'n';  // 'n' = number type
              ws[drCellAddress].z = '#,##0.00';  // Currency format
            }
          }
          
          if (enteredCRColIndex >= 0) {
            const crCellAddress = XLSX.utils.encode_cell({ r: row, c: enteredCRColIndex });
            if (ws[crCellAddress] && ws[crCellAddress].v !== null && ws[crCellAddress].v !== "") {
              ws[crCellAddress].t = 'n';  // 'n' = number type
              ws[crCellAddress].z = '#,##0.00';  // Currency format
            }
          }
        }
        
        console.log(`✓ Currency columns formatted with #,##0.00`);
        
        // ================================================================
        // SET COLUMN WIDTHS (NO S.No COLUMN)
        // ================================================================
        let colWidths = [];
        columnConfig.forEach(col => {
          colWidths.push({ width: col.width });
        });
        ws['!cols'] = colWidths;
        
        // Freeze header row for easy scrolling
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        
        // Add worksheet to workbook and download
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
        
        // Reset searchLineObj to default values
        $variables.searchLineObj.IN_LIMIT = "";
        $variables.searchLineObj.IN_OFFSET = "";
        $variables.searchLineObj.P_BATCH_ID = "";
        
        await Actions.fireNotificationEvent(context, {
          summary: 'Export Successful',
          message: `Successfully exported ${consolidatedResults.length} GL journal entry records to Excel (Batch: ${P_BATCH_ID})`,
          type: 'confirmation',
          displayMode: 'transient'
        });
        
        console.log("=== EXPORT COMPLETED SUCCESSFULLY ===");
        
        return consolidatedResults;
        
      } catch (error) {
        console.error("=== EXPORT FAILED ===");
        console.error("Error:", error);
        console.error("Stack:", error.stack);
        
        // Reset searchLineObj even on error
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
