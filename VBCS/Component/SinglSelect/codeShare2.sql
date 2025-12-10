<div>
    <oj-select-single style="width: 18rem;" value="{{ $variables.reProcessObj.LegalEntity }}" label-hint="Legal Entity"
      data="[[$variables.getLegalEntityListSDP2]]" item-text="legal_entity" id="legid" ></oj-select-single>
    <span class="oj-ux-ico-information" on-click="[[$listeners.iconClick]]"></span>    
</div>
<oj-highlight-text style="color: red;" text="[[$application.translations.appBundle.msg]]" match-text="Highlight"></oj-highlight-text>



<!-- DELETE DIALOG -->
<oj-popup id="popDialog" tail="simple" position.at.vertical="top" modality="modal">
 <oj-highlight-text style="color: red;" text="[[$application.translations.appBundle.msg]]" match-text="Highlight"></oj-highlight-text>
</oj-popup>


      const popDialogOpen = await Actions.callComponentMethod(context, {
        selector: '#popDialog',
        method: 'open',
      });
