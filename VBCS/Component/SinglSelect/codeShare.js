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

  class onReprocessOk extends ActionChain {

    /**
     * @param {Object} context
     * @param {Object} params
     * @param {object} params.event
     * @param {any} params.originalEvent
     */
    async run(context, { event, originalEvent }) {
      const { $page, $flow, $application, $constants, $variables } = context;

      console.log("FromDate==>"+$variables.reProcessObj.FromDate);
      console.log("ToDate==>"+$variables.reProcessObj.ToDate);

      let lvFromDate = await this.formatDate(context, { dateValue: $variables.reProcessObj.FromDate });
      let lvToDate = await this.formatDate(context, { dateValue: $variables.reProcessObj.ToDate });

      console.log("Formatted FromDate==>"+lvFromDate);
      console.log("Formatted ToDate==>"+lvToDate);

      $variables.reProcessObj_lv.FromDate = lvFromDate;
      $variables.reProcessObj_lv.ToDate = lvToDate;
      $variables.reProcessObj_lv.PeriodName = $variables.reProcessObj.PeriodName;
      $variables.reProcessObj_lv.LegalEntity = $variables.reProcessObj.LegalEntity;


      if ($variables.intForm === 'valid') {
        const progressDialogOpen = await Actions.callComponentMethod(context, {
          selector: '#progressDialog',
          method: 'open',
        });

        const response = await Actions.callRest(context, {
          endpoint: 'ics/postNavabrexrRecon',
          body: $variables.reProcessObj_lv,
        });

        if (response.ok === true) {

          const progressDialogClose = await Actions.callComponentMethod(context, {
            selector: '#progressDialog',
            method: 'close',
          });

          const reprocessDialogClose2 = await Actions.callComponentMethod(context, {
            selector: '#reprocessDialog',
            method: 'close',
          });

          await Actions.fireNotificationEvent(context, {
            summary: 'Process Started Successfully',
            type: 'info',
          });

          await Actions.callChain(context, {
            chain: 'searchAC',
          });
        } else {

          await Actions.fireNotificationEvent(context, {
            summary: 'Error in Integration Process',
            type: 'info',
          });

          await Actions.callChain(context, {
            chain: 'searchAC',
          });

          const reprocessDialogClose = await Actions.callComponentMethod(context, {
            selector: '#reprocessDialog',
            method: 'close',
          });
          const progressDialogClose3 = await Actions.callComponentMethod(context, {
            selector: '#progressDialog',
            method: 'close',
          });
        }
      } else {
        const progressDialogClose2 = await Actions.callComponentMethod(context, {
          selector: '#progressDialog',
          method: 'close',
        });

        await Actions.fireNotificationEvent(context, {
          summary: 'Please select the requied fields',
          displayMode: 'transient',
        });
      }
    }

    /**
     * CORRECTED: Parse date string directly to avoid timezone conversion issues
     * 
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.dateValue - Input format: YYYY-MM-DD (e.g., 2025-05-05)
     * @return {string} - Output format: MM-DD-YYYY (e.g., 05-05-2025)
     * 
     * WHY THIS WORKS:
     * - OLD: new Date("2025-05-05") → Parsed as UTC → Local timezone conversion → Wrong date
     * - NEW: Split string directly → No timezone conversion → Correct date always
     */
    async formatDate(context, { dateValue }) {
      const { $page, $flow, $application, $constants, $variables } = context;
    
      if (!dateValue) {
        console.warn('formatDate: dateValue is null or empty');
        return "";
      }
      
      // Parse string directly: YYYY-MM-DD
      // This avoids JavaScript Date object's timezone conversion
      const parts = dateValue.split('-');
      
      if (parts.length !== 3) {
        console.error('formatDate: Invalid date format. Expected YYYY-MM-DD, received:', dateValue);
        return "";
      }
      
      const year = parts[0];           // YYYY
      const month = parts[1];          // MM
      const day = parts[2];            // DD
      
      // Validate parts are valid numbers
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.error('formatDate: Date parts contain non-numeric values:', { year, month, day });
        return "";
      }
      
      // Ensure month and day are zero-padded
      const formattedMonth = String(month).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      
      // Output format: MM-DD-YYYY (e.g., 05-05-2025)
      const result = `${formattedMonth}-${formattedDay}-${year}`;
      
      console.log(`formatDate conversion: ${dateValue} → ${result}`);
      
      return result;
    }
  }

  return onReprocessOk;
});
