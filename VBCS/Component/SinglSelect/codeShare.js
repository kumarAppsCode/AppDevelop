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

    let lvFromDate=  await this.formatDate(context, { dateValue: $variables.reProcessObj.FromDate });
    let lvToDate=  await this.formatDate(context, { dateValue: $variables.reProcessObj.ToDate });

      $variables.reProcessObj_lv.FromDate=lvFromDate;
      $variables.reProcessObj_lv.ToDate=lvToDate;
      $variables.reProcessObj_lv.PeriodName=$variables.reProcessObj.PeriodName;
      $variables.reProcessObj_lv.LegalEntity=$variables.reProcessObj.LegalEntity;


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
     * @param {Object} context
     * @param {Object} params
     * @param {string} params.dateValue
     * @return {string} 
     */
    async formatDate(context, { dateValue }) {
      const { $page, $flow, $application, $constants, $variables } = context;
    
      if (!dateValue) return "";
      
      const date = new Date(dateValue);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${month}-${day}-${year}`;

    }
  }

  return onReprocessOk;
});
