import{a as ke}from"./chunk-GD6HMKGN.js";import{c as dt}from"./chunk-AQL72Y6Q.js";import{d as lt,e as ut}from"./chunk-P6E4SAF2.js";import{j as ct}from"./chunk-NBSG7FOD.js";import{e as _e}from"./chunk-BO33TEMQ.js";import{a as at,u as pt}from"./chunk-TRNMS3RB.js";import{f as it,la as rt,pa as st,qa as z,ta as oe,va as ie,wa as re,xa as T,ya as Ce}from"./chunk-TPQCZETP.js";import{c as Ze,f as et,h as tt,j as nt,p as Me,q as S,s as ot}from"./chunk-CPPNARZW.js";import{$ as ce,Aa as He,Ab as J,C as Oe,Cb as b,Da as f,Db as X,E as Le,Eb as Z,Fb as Ve,G as $e,H as Fe,Hb as le,I as Ue,Ib as ue,K as m,Lb as Ke,M as $,Nb as Ye,Ob as we,Pb as A,Q as F,Qb as R,R as Q,Rb as de,Sb as Ae,T as W,Ta as G,U as N,Ua as V,V as I,Xa as K,Xb as ee,Ya as Y,Yb as Je,Za as U,Zb as Xe,aa as pe,ba as ze,c as q,db as P,eb as je,fb as qe,ga as Be,gb as E,gc as te,h as Ne,hb as O,i as a,j as k,jb as Qe,ka as Ge,kb as We,lb as y,lc as me,m as ve,mb as w,n as D,nb as v,o as d,ob as M,oc as Re,pa as B,pc as ne,u as x,ub as be,v as Pe,vb as ye,wc as Se,x as l,y as Ee}from"./chunk-Y4EJPK2B.js";import{a as j,b as fe}from"./chunk-Q7L6LLAK.js";var mt=`
    .p-inputgroup,
    .p-inputgroup .p-iconfield,
    .p-inputgroup .p-floatlabel,
    .p-inputgroup .p-iftalabel {
        display: flex;
        align-items: stretch;
        width: 100%;
    }

    .p-inputgroup .p-floatlabel .p-inputwrapper,
    .p-inputgroup .p-iftalabel .p-inputwrapper {
        display: inline-flex;
    }

    .p-inputgroup .p-inputtext,
    .p-inputgroup .p-inputwrapper {
        flex: 1 1 auto;
        width: 1%;
    }

    .p-inputgroupaddon {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: dt('inputgroup.addon.padding');
        background: dt('inputgroup.addon.background');
        color: dt('inputgroup.addon.color');
        border-block-start: 1px solid dt('inputgroup.addon.border.color');
        border-block-end: 1px solid dt('inputgroup.addon.border.color');
        min-width: dt('inputgroup.addon.min.width');
    }

    .p-inputgroupaddon:first-child,
    .p-inputgroupaddon + .p-inputgroupaddon {
        border-inline-start: 1px solid dt('inputgroup.addon.border.color');
    }

    .p-inputgroupaddon:last-child {
        border-inline-end: 1px solid dt('inputgroup.addon.border.color');
    }

    .p-inputgroupaddon:has(.p-button) {
        padding: 0;
        overflow: hidden;
    }

    .p-inputgroupaddon .p-button {
        border-radius: 0;
    }

    .p-inputgroup > .p-component,
    .p-inputgroup > .p-inputwrapper > .p-component,
    .p-inputgroup > .p-iconfield > .p-component,
    .p-inputgroup > .p-floatlabel > .p-component,
    .p-inputgroup > .p-floatlabel > .p-inputwrapper > .p-component,
    .p-inputgroup > .p-iftalabel > .p-component,
    .p-inputgroup > .p-iftalabel > .p-inputwrapper > .p-component {
        border-radius: 0;
        margin: 0;
    }

    .p-inputgroupaddon:first-child,
    .p-inputgroup > .p-component:first-child,
    .p-inputgroup > .p-inputwrapper:first-child > .p-component,
    .p-inputgroup > .p-iconfield:first-child > .p-component,
    .p-inputgroup > .p-floatlabel:first-child > .p-component,
    .p-inputgroup > .p-floatlabel:first-child > .p-inputwrapper > .p-component,
    .p-inputgroup > .p-iftalabel:first-child > .p-component,
    .p-inputgroup > .p-iftalabel:first-child > .p-inputwrapper > .p-component {
        border-start-start-radius: dt('inputgroup.addon.border.radius');
        border-end-start-radius: dt('inputgroup.addon.border.radius');
    }

    .p-inputgroupaddon:last-child,
    .p-inputgroup > .p-component:last-child,
    .p-inputgroup > .p-inputwrapper:last-child > .p-component,
    .p-inputgroup > .p-iconfield:last-child > .p-component,
    .p-inputgroup > .p-floatlabel:last-child > .p-component,
    .p-inputgroup > .p-floatlabel:last-child > .p-inputwrapper > .p-component,
    .p-inputgroup > .p-iftalabel:last-child > .p-component,
    .p-inputgroup > .p-iftalabel:last-child > .p-inputwrapper > .p-component {
        border-start-end-radius: dt('inputgroup.addon.border.radius');
        border-end-end-radius: dt('inputgroup.addon.border.radius');
    }

    .p-inputgroup .p-component:focus,
    .p-inputgroup .p-component.p-focus,
    .p-inputgroup .p-inputwrapper-focus,
    .p-inputgroup .p-component:focus ~ label,
    .p-inputgroup .p-component.p-focus ~ label,
    .p-inputgroup .p-inputwrapper-focus ~ label,
    .p-inputgroup .p-floatlabel .p-inputwrapper ~ label,
    .p-inputgroup .p-iftalabel .p-inputwrapper ~ label {
        z-index: 1;
    }

    .p-inputgroup > .p-button:not(.p-button-icon-only) {
        width: auto;
    }

    .p-inputgroup .p-iconfield + .p-iconfield .p-inputtext {
        border-inline-start: 0;
    }
`;var St=["*"],Mt=`
    ${mt}

    /*For PrimeNG*/

    .p-inputgroup > .p-component,
    .p-inputgroup > .p-inputwrapper > .p-component,
    .p-inputgroup:first-child > p-button > .p-button,
    .p-inputgroup > .p-floatlabel > .p-component,
    .p-inputgroup > .p-floatlabel > .p-inputwrapper > .p-component,
    .p-inputgroup > .p-iftalabel > .p-component,
    .p-inputgroup > .p-iftalabel > .p-inputwrapper > .p-component {
        border-radius: 0;
        margin: 0;
    }

    .p-inputgroup p-button:first-child,
    .p-inputgroup p-button:last-child {
        display: inline-flex;
    }

    .p-inputgroup:has(> p-button:first-child) .p-button {
        border-start-start-radius: dt('inputgroup.addon.border.radius');
        border-end-start-radius: dt('inputgroup.addon.border.radius');
    }

    .p-inputgroup:has(> p-button:last-child) .p-button {
        border-start-end-radius: dt('inputgroup.addon.border.radius');
        border-end-end-radius: dt('inputgroup.addon.border.radius');
    }

    .p-inputgroup > p-inputmask > .p-inputtext {
        width: 100%;
    }
`,Tt={root:({instance:i})=>["p-inputgroup",{"p-inputgroup-fluid":i.fluid}]},gt=(()=>{class i extends oe{name="inputgroup";style=Mt;classes=Tt;static \u0275fac=(()=>{let e;return function(t){return(e||(e=B(i)))(t||i)}})();static \u0275prov=F({token:i,factory:i.\u0275fac})}return i})();var ht=new W("INPUTGROUP_INSTANCE"),Dt=(()=>{class i extends re{componentName="InputGroup";_componentStyle=I(gt);$pcInputGroup=I(ht,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=I(T,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}styleClass;static \u0275fac=(()=>{let e;return function(t){return(e||(e=B(i)))(t||i)}})();static \u0275cmp=G({type:i,selectors:[["p-inputgroup"],["p-inputGroup"],["p-input-group"]],hostVars:2,hostBindings:function(n,t){n&2&&A(t.cn(t.cx("root"),t.styleClass))},inputs:{styleClass:"styleClass"},features:[ee([gt,{provide:ht,useExisting:i},{provide:ie,useExisting:i}]),K([T]),Y],ngContentSelectors:St,decls:1,vars:0,template:function(n,t){n&1&&(X(),Z(0))},dependencies:[Ce],encapsulation:2})}return i})(),Sn=(()=>{class i{static \u0275fac=function(n){return new(n||i)};static \u0275mod=V({type:i});static \u0275inj=Q({imports:[Dt,z,z]})}return i})();var It=["*"],Nt={root:"p-inputgroupaddon"},vt=(()=>{class i extends oe{name="inputgroupaddon";classes=Nt;static \u0275fac=(()=>{let e;return function(t){return(e||(e=B(i)))(t||i)}})();static \u0275prov=F({token:i,factory:i.\u0275fac})}return i})(),bt=new W("INPUTGROUPADDON_INSTANCE"),Pt=(()=>{class i extends re{componentName="InputGroupAddon";_componentStyle=I(vt);$pcInputGroupAddon=I(bt,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=I(T,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}style;styleClass;get hostStyle(){return this.style}static \u0275fac=(()=>{let e;return function(t){return(e||(e=B(i)))(t||i)}})();static \u0275cmp=G({type:i,selectors:[["p-inputgroup-addon"],["p-inputGroupAddon"]],hostVars:4,hostBindings:function(n,t){n&2&&(we(t.hostStyle),A(t.cn(t.cx("root"),t.styleClass)))},inputs:{style:"style",styleClass:"styleClass"},features:[ee([vt,{provide:bt,useExisting:i},{provide:ie,useExisting:i}]),K([T]),Y],ngContentSelectors:It,decls:1,vars:0,template:function(n,t){n&1&&(X(),Z(0))},dependencies:[Ce],encapsulation:2})}return i})(),Un=(()=>{class i{static \u0275fac=function(n){return new(n||i)};static \u0275mod=V({type:i});static \u0275inj=Q({imports:[Pt,z,z]})}return i})();var L=class extends Error{constructor(h,e,n){super(h),this.code=e,this.statusCode=n,this.name="PermissionError"}};var xe=class extends Error{constructor(h,e,n){super(h),this.code=e,this.statusCode=n,this.name="StorageAccountError"}};var yt=`
    .p-message {
        display: grid;
        grid-template-rows: 1fr;
        border-radius: dt('message.border.radius');
        outline-width: dt('message.border.width');
        outline-style: solid;
    }

    .p-message-content-wrapper {
        min-height: 0;
    }

    .p-message-content {
        display: flex;
        align-items: center;
        padding: dt('message.content.padding');
        gap: dt('message.content.gap');
    }

    .p-message-icon {
        flex-shrink: 0;
    }

    .p-message-close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-inline-start: auto;
        overflow: hidden;
        position: relative;
        width: dt('message.close.button.width');
        height: dt('message.close.button.height');
        border-radius: dt('message.close.button.border.radius');
        background: transparent;
        transition:
            background dt('message.transition.duration'),
            color dt('message.transition.duration'),
            outline-color dt('message.transition.duration'),
            box-shadow dt('message.transition.duration'),
            opacity 0.3s;
        outline-color: transparent;
        color: inherit;
        padding: 0;
        border: none;
        cursor: pointer;
        user-select: none;
    }

    .p-message-close-icon {
        font-size: dt('message.close.icon.size');
        width: dt('message.close.icon.size');
        height: dt('message.close.icon.size');
    }

    .p-message-close-button:focus-visible {
        outline-width: dt('message.close.button.focus.ring.width');
        outline-style: dt('message.close.button.focus.ring.style');
        outline-offset: dt('message.close.button.focus.ring.offset');
    }

    .p-message-info {
        background: dt('message.info.background');
        outline-color: dt('message.info.border.color');
        color: dt('message.info.color');
        box-shadow: dt('message.info.shadow');
    }

    .p-message-info .p-message-close-button:focus-visible {
        outline-color: dt('message.info.close.button.focus.ring.color');
        box-shadow: dt('message.info.close.button.focus.ring.shadow');
    }

    .p-message-info .p-message-close-button:hover {
        background: dt('message.info.close.button.hover.background');
    }

    .p-message-info.p-message-outlined {
        color: dt('message.info.outlined.color');
        outline-color: dt('message.info.outlined.border.color');
    }

    .p-message-info.p-message-simple {
        color: dt('message.info.simple.color');
    }

    .p-message-success {
        background: dt('message.success.background');
        outline-color: dt('message.success.border.color');
        color: dt('message.success.color');
        box-shadow: dt('message.success.shadow');
    }

    .p-message-success .p-message-close-button:focus-visible {
        outline-color: dt('message.success.close.button.focus.ring.color');
        box-shadow: dt('message.success.close.button.focus.ring.shadow');
    }

    .p-message-success .p-message-close-button:hover {
        background: dt('message.success.close.button.hover.background');
    }

    .p-message-success.p-message-outlined {
        color: dt('message.success.outlined.color');
        outline-color: dt('message.success.outlined.border.color');
    }

    .p-message-success.p-message-simple {
        color: dt('message.success.simple.color');
    }

    .p-message-warn {
        background: dt('message.warn.background');
        outline-color: dt('message.warn.border.color');
        color: dt('message.warn.color');
        box-shadow: dt('message.warn.shadow');
    }

    .p-message-warn .p-message-close-button:focus-visible {
        outline-color: dt('message.warn.close.button.focus.ring.color');
        box-shadow: dt('message.warn.close.button.focus.ring.shadow');
    }

    .p-message-warn .p-message-close-button:hover {
        background: dt('message.warn.close.button.hover.background');
    }

    .p-message-warn.p-message-outlined {
        color: dt('message.warn.outlined.color');
        outline-color: dt('message.warn.outlined.border.color');
    }

    .p-message-warn.p-message-simple {
        color: dt('message.warn.simple.color');
    }

    .p-message-error {
        background: dt('message.error.background');
        outline-color: dt('message.error.border.color');
        color: dt('message.error.color');
        box-shadow: dt('message.error.shadow');
    }

    .p-message-error .p-message-close-button:focus-visible {
        outline-color: dt('message.error.close.button.focus.ring.color');
        box-shadow: dt('message.error.close.button.focus.ring.shadow');
    }

    .p-message-error .p-message-close-button:hover {
        background: dt('message.error.close.button.hover.background');
    }

    .p-message-error.p-message-outlined {
        color: dt('message.error.outlined.color');
        outline-color: dt('message.error.outlined.border.color');
    }

    .p-message-error.p-message-simple {
        color: dt('message.error.simple.color');
    }

    .p-message-secondary {
        background: dt('message.secondary.background');
        outline-color: dt('message.secondary.border.color');
        color: dt('message.secondary.color');
        box-shadow: dt('message.secondary.shadow');
    }

    .p-message-secondary .p-message-close-button:focus-visible {
        outline-color: dt('message.secondary.close.button.focus.ring.color');
        box-shadow: dt('message.secondary.close.button.focus.ring.shadow');
    }

    .p-message-secondary .p-message-close-button:hover {
        background: dt('message.secondary.close.button.hover.background');
    }

    .p-message-secondary.p-message-outlined {
        color: dt('message.secondary.outlined.color');
        outline-color: dt('message.secondary.outlined.border.color');
    }

    .p-message-secondary.p-message-simple {
        color: dt('message.secondary.simple.color');
    }

    .p-message-contrast {
        background: dt('message.contrast.background');
        outline-color: dt('message.contrast.border.color');
        color: dt('message.contrast.color');
        box-shadow: dt('message.contrast.shadow');
    }

    .p-message-contrast .p-message-close-button:focus-visible {
        outline-color: dt('message.contrast.close.button.focus.ring.color');
        box-shadow: dt('message.contrast.close.button.focus.ring.shadow');
    }

    .p-message-contrast .p-message-close-button:hover {
        background: dt('message.contrast.close.button.hover.background');
    }

    .p-message-contrast.p-message-outlined {
        color: dt('message.contrast.outlined.color');
        outline-color: dt('message.contrast.outlined.border.color');
    }

    .p-message-contrast.p-message-simple {
        color: dt('message.contrast.simple.color');
    }

    .p-message-text {
        font-size: dt('message.text.font.size');
        font-weight: dt('message.text.font.weight');
    }

    .p-message-icon {
        font-size: dt('message.icon.size');
        width: dt('message.icon.size');
        height: dt('message.icon.size');
    }

    .p-message-sm .p-message-content {
        padding: dt('message.content.sm.padding');
    }

    .p-message-sm .p-message-text {
        font-size: dt('message.text.sm.font.size');
    }

    .p-message-sm .p-message-icon {
        font-size: dt('message.icon.sm.size');
        width: dt('message.icon.sm.size');
        height: dt('message.icon.sm.size');
    }

    .p-message-sm .p-message-close-icon {
        font-size: dt('message.close.icon.sm.size');
        width: dt('message.close.icon.sm.size');
        height: dt('message.close.icon.sm.size');
    }

    .p-message-lg .p-message-content {
        padding: dt('message.content.lg.padding');
    }

    .p-message-lg .p-message-text {
        font-size: dt('message.text.lg.font.size');
    }

    .p-message-lg .p-message-icon {
        font-size: dt('message.icon.lg.size');
        width: dt('message.icon.lg.size');
        height: dt('message.icon.lg.size');
    }

    .p-message-lg .p-message-close-icon {
        font-size: dt('message.close.icon.lg.size');
        width: dt('message.close.icon.lg.size');
        height: dt('message.close.icon.lg.size');
    }

    .p-message-outlined {
        background: transparent;
        outline-width: dt('message.outlined.border.width');
    }

    .p-message-simple {
        background: transparent;
        outline-color: transparent;
        box-shadow: none;
    }

    .p-message-simple .p-message-content {
        padding: dt('message.simple.content.padding');
    }

    .p-message-outlined .p-message-close-button:hover,
    .p-message-simple .p-message-close-button:hover {
        background: transparent;
    }

    .p-message-enter-active {
        animation: p-animate-message-enter 0.3s ease-out forwards;
        overflow: hidden;
    }

    .p-message-leave-active {
        animation: p-animate-message-leave 0.15s ease-in forwards;
        overflow: hidden;
    }

    @keyframes p-animate-message-enter {
        from {
            opacity: 0;
            grid-template-rows: 0fr;
        }
        to {
            opacity: 1;
            grid-template-rows: 1fr;
        }
    }

    @keyframes p-animate-message-leave {
        from {
            opacity: 1;
            grid-template-rows: 1fr;
        }
        to {
            opacity: 0;
            margin: 0;
            grid-template-rows: 0fr;
        }
    }
`;var Et=["container"],Ot=["icon"],Lt=["closeicon"],$t=["*"],Ft=i=>({closeCallback:i});function Ut(i,h){i&1&&be(0)}function zt(i,h){if(i&1&&U(0,Ut,1,0,"ng-container",4),i&2){let e=b();y("ngTemplateOutlet",e.iconTemplate||e._iconTemplate)}}function Bt(i,h){if(i&1&&M(0,"i",1),i&2){let e=b();A(e.cn(e.cx("icon"),e.icon)),y("pBind",e.ptm("icon")),P("data-p",e.dataP)}}function Gt(i,h){i&1&&be(0)}function Ht(i,h){if(i&1&&U(0,Gt,1,0,"ng-container",5),i&2){let e=b();y("ngTemplateOutlet",e.containerTemplate||e._containerTemplate)("ngTemplateOutletContext",Xe(2,Ft,e.closeCallback))}}function jt(i,h){if(i&1&&M(0,"span",9),i&2){let e=b(3);y("pBind",e.ptm("text"))("ngClass",e.cx("text"))("innerHTML",e.text,He),P("data-p",e.dataP)}}function qt(i,h){if(i&1&&(w(0,"div"),U(1,jt,1,4,"span",8),v()),i&2){let e=b(2);f(),y("ngIf",!e.escape)}}function Qt(i,h){if(i&1&&(w(0,"span",7),R(1),v()),i&2){let e=b(3);y("pBind",e.ptm("text"))("ngClass",e.cx("text")),P("data-p",e.dataP),f(),de(e.text)}}function Wt(i,h){if(i&1&&U(0,Qt,2,4,"span",10),i&2){let e=b(2);y("ngIf",e.escape&&e.text)}}function Vt(i,h){if(i&1&&(U(0,qt,2,1,"div",6)(1,Wt,1,1,"ng-template",null,0,te),w(3,"span",7),Z(4),v()),i&2){let e=Ke(2),n=b();y("ngIf",!n.escape)("ngIfElse",e),f(3),y("pBind",n.ptm("text"))("ngClass",n.cx("text")),P("data-p",n.dataP)}}function Kt(i,h){if(i&1&&M(0,"i",7),i&2){let e=b(2);A(e.cn(e.cx("closeIcon"),e.closeIcon)),y("pBind",e.ptm("closeIcon"))("ngClass",e.closeIcon),P("data-p",e.dataP)}}function Yt(i,h){i&1&&be(0)}function Jt(i,h){if(i&1&&U(0,Yt,1,0,"ng-container",4),i&2){let e=b(2);y("ngTemplateOutlet",e.closeIconTemplate||e._closeIconTemplate)}}function Xt(i,h){if(i&1&&(ze(),M(0,"svg",14)),i&2){let e=b(2);A(e.cx("closeIcon")),y("pBind",e.ptm("closeIcon")),P("data-p",e.dataP)}}function Zt(i,h){if(i&1){let e=ye();w(0,"button",11),J("click",function(t){ce(e);let o=b();return pe(o.close(t))}),E(1,Kt,1,5,"i",12),E(2,Jt,1,1,"ng-container"),E(3,Xt,1,4,":svg:svg",13),v()}if(i&2){let e=b();A(e.cx("closeButton")),y("pBind",e.ptm("closeButton")),P("aria-label",e.closeAriaLabel)("data-p",e.dataP),f(),O(e.closeIcon?1:-1),f(),O(e.closeIconTemplate||e._closeIconTemplate?2:-1),f(),O(!e.closeIconTemplate&&!e._closeIconTemplate&&!e.closeIcon?3:-1)}}var en={root:({instance:i})=>["p-message p-component p-message-"+i.severity,i.variant&&"p-message-"+i.variant,{"p-message-sm":i.size==="small","p-message-lg":i.size==="large"}],contentWrapper:"p-message-content-wrapper",content:"p-message-content",icon:"p-message-icon",text:"p-message-text",closeButton:"p-message-close-button",closeIcon:"p-message-close-icon"},wt=(()=>{class i extends oe{name="message";style=yt;classes=en;static \u0275fac=(()=>{let e;return function(t){return(e||(e=B(i)))(t||i)}})();static \u0275prov=F({token:i,factory:i.\u0275fac})}return i})();var Ct=new W("MESSAGE_INSTANCE"),Te=(()=>{class i extends re{componentName="Message";_componentStyle=I(wt);bindDirectiveInstance=I(T,{self:!0});$pcMessage=I(Ct,{optional:!0,skipSelf:!0})??void 0;onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}severity="info";text;escape=!0;style;styleClass;closable=!1;icon;closeIcon;life;showTransitionOptions="300ms ease-out";hideTransitionOptions="200ms cubic-bezier(0.86, 0, 0.07, 1)";size;variant;motionOptions=ne(void 0);computedMotionOptions=me(()=>j(j({},this.ptm("motion")),this.motionOptions()));onClose=new Be;get closeAriaLabel(){return this.config.translation.aria?this.config.translation.aria.close:void 0}visible=Ge(!0);containerTemplate;iconTemplate;closeIconTemplate;templates;_containerTemplate;_iconTemplate;_closeIconTemplate;closeCallback=e=>{this.close(e)};onInit(){this.life&&setTimeout(()=>{this.visible.set(!1)},this.life)}onAfterContentInit(){this.templates?.forEach(e=>{switch(e.getType()){case"container":this._containerTemplate=e.template;break;case"icon":this._iconTemplate=e.template;break;case"closeicon":this._closeIconTemplate=e.template;break}})}close(e){this.visible.set(!1),this.onClose.emit({originalEvent:e})}get dataP(){return this.cn({outlined:this.variant==="outlined",simple:this.variant==="simple",[this.severity]:this.severity,[this.size]:this.size})}static \u0275fac=(()=>{let e;return function(t){return(e||(e=B(i)))(t||i)}})();static \u0275cmp=G({type:i,selectors:[["p-message"]],contentQueries:function(n,t,o){if(n&1&&Ve(o,Et,4)(o,Ot,4)(o,Lt,4)(o,st,4),n&2){let r;le(r=ue())&&(t.containerTemplate=r.first),le(r=ue())&&(t.iconTemplate=r.first),le(r=ue())&&(t.closeIconTemplate=r.first),le(r=ue())&&(t.templates=r)}},hostAttrs:["role","alert","aria-live","polite"],hostVars:5,hostBindings:function(n,t){n&1&&(je(function(){return"p-message-enter-active"}),qe(function(){return"p-message-leave-active"})),n&2&&(P("data-p",t.dataP),A(t.cn(t.cx("root"),t.styleClass)),Ye("p-message-leave-active",!t.visible()))},inputs:{severity:"severity",text:"text",escape:[2,"escape","escape",Se],style:"style",styleClass:"styleClass",closable:[2,"closable","closable",Se],icon:"icon",closeIcon:"closeIcon",life:"life",showTransitionOptions:"showTransitionOptions",hideTransitionOptions:"hideTransitionOptions",size:"size",variant:"variant",motionOptions:[1,"motionOptions"]},outputs:{onClose:"onClose"},features:[ee([wt,{provide:Ct,useExisting:i},{provide:ie,useExisting:i}]),K([T]),Y],ngContentSelectors:$t,decls:7,vars:12,consts:[["escapeOut",""],[3,"pBind"],[3,"pBind","class"],["pRipple","","type","button",3,"pBind","class"],[4,"ngTemplateOutlet"],[4,"ngTemplateOutlet","ngTemplateOutletContext"],[4,"ngIf","ngIfElse"],[3,"pBind","ngClass"],[3,"pBind","ngClass","innerHTML",4,"ngIf"],[3,"pBind","ngClass","innerHTML"],[3,"pBind","ngClass",4,"ngIf"],["pRipple","","type","button",3,"click","pBind"],[3,"pBind","class","ngClass"],["data-p-icon","times",3,"pBind","class"],["data-p-icon","times",3,"pBind"]],template:function(n,t){n&1&&(X(),w(0,"div",1)(1,"div",1),E(2,zt,1,1,"ng-container"),E(3,Bt,1,4,"i",2),E(4,Ht,1,4,"ng-container")(5,Vt,5,5),E(6,Zt,4,8,"button",3),v()()),n&2&&(A(t.cx("contentWrapper")),y("pBind",t.ptm("contentWrapper")),P("data-p",t.dataP),f(),A(t.cx("content")),y("pBind",t.ptm("content")),P("data-p",t.dataP),f(),O(t.iconTemplate||t._iconTemplate?2:-1),f(),O(t.icon?3:-1),f(),O(t.containerTemplate||t._containerTemplate?4:5),f(2),O(t.closable?6:-1))},dependencies:[nt,Ze,et,tt,at,ct,z,T,pt],encapsulation:2,changeDetection:0})}return i})(),_t=(()=>{class i{static \u0275fac=function(n){return new(n||i)};static \u0275mod=V({type:i});static \u0275inj=Q({imports:[Te,z,z]})}return i})();var nn=()=>({width:"600px"}),on=(i,h)=>h.name;function rn(i,h){i&1&&M(0,"i",13)}function sn(i,h){if(i&1&&(w(0,"div",16)(1,"strong"),R(2,"Notes:"),v(),R(3),v()),i&2){let e=b().$implicit;f(3),Ae(" ",e.notes," ")}}function an(i,h){if(i&1&&(w(0,"div",8)(1,"div",14)(2,"strong"),R(3),v(),w(4,"span",15),R(5),v()(),E(6,sn,4,1,"div",16),v()),i&2){let e=h.$implicit,n=b(2);f(3),de(e.name),f(),A(n.getLockLevelClass(e.level)),f(),de(e.level),f(),O(e.notes?6:-1)}}function cn(i,h){if(i&1&&(w(0,"p-message",4),U(1,rn,1,0,"ng-template",null,2,te),v(),w(3,"section",5)(4,"h4"),M(5,"i",6),R(6," Lock Details"),v(),w(7,"div",7),Qe(8,an,7,5,"div",8,on),v()(),w(10,"section",9)(11,"h4"),M(12,"i",10),R(13," What will happen:"),v(),w(14,"ol",11)(15,"li"),R(16,"The lock(s) will be temporarily removed"),v(),w(17,"li"),R(18),v(),w(19,"li"),R(20,"The lock(s) will be recreated with the same configuration"),v()()(),M(21,"p-message",12)),i&2){let e,n,t=b();y("text",t.alertMessage()+": "+t.alertDescription()),f(8),We((e=t.data())==null?null:e.locks),f(10),Ae("The ",(n=t.data())==null?null:n.operationType," operation will be performed")}}function pn(i,h){i&1&&M(0,"i",21)}function ln(i,h){i&1&&M(0,"i",22)}function un(i,h){if(i&1){let e=ye();w(0,"div",17)(1,"button",18),J("click",function(){ce(e);let t=b();return pe(t.onCancel())}),M(2,"i",19),R(3," Cancel "),v(),w(4,"button",20),J("click",function(){ce(e);let t=b();return pe(t.onConfirm())}),E(5,pn,1,0,"i",21)(6,ln,1,0,"i",22),R(7," Remove Lock & Continue "),v()()}if(i&2){let e=b();f(4),y("disabled",e.loading()),f(),O(e.loading()?5:6)}}var kt=(()=>{class i{constructor(){this.visible=ne(!1),this.loading=ne(!1),this.data=ne(null),this.confirm=Re(),this.cancel=Re(),this.alertMessage=me(()=>`Resource Lock${(this.data()?.lockCount||0)>1?"s":""} Preventing Operation`),this.alertDescription=me(()=>{let e=this.data()?.lockCount||0,n=this.data()?.resourceName||"this resource",t=this.data()?.operationType||"the operation";return`${n} has ${e} active lock${e>1?"s":""} that prevent${e===1?"s":""} ${t}. To proceed, the lock${e>1?"s":""} must be temporarily removed.`})}getLockLevelClass(e){switch(e?.toLowerCase()){case"readonly":return"lock-level-badge lock-level-readonly";case"cannotdelete":return"lock-level-badge lock-level-cannotdelete";default:return"lock-level-badge"}}onConfirm(){this.confirm.emit()}onCancel(){this.cancel.emit()}static{this.\u0275fac=function(n){return new(n||i)}}static{this.\u0275cmp=G({type:i,selectors:[["app-lock-confirmation-modal"]],inputs:{visible:[1,"visible"],loading:[1,"loading"],data:[1,"data"]},outputs:{confirm:"confirm",cancel:"cancel"},decls:5,vars:8,consts:[["content",""],["footer",""],["icon",""],["header","Resource Lock Detected","styleClass","lock-confirmation-modal",3,"visibleChange","onHide","visible","modal","closable","draggable","resizable"],["severity","warn","styleClass","alert-message",3,"text"],[1,"lock-details"],[1,"pi","pi-lock","icon-warning"],[1,"lock-list"],[1,"lock-item"],[1,"workflow-explanation"],[1,"pi","pi-info-circle","icon-info"],[1,"workflow-steps"],["severity","info","text","Security Notice: The resource will be temporarily unprotected during this operation. The lock will be recreated immediately after completion.","styleClass","security-notice"],[1,"pi","pi-exclamation-triangle"],[1,"lock-item-header"],[1,"lock-level-badge"],[1,"lock-notes"],[1,"modal-footer"],[1,"btn","btn-text",3,"click"],[1,"pi","pi-times"],[1,"btn","btn-danger",3,"click","disabled"],[1,"pi","pi-spinner","pi-spin"],[1,"pi","pi-unlock"]],template:function(n,t){n&1&&(w(0,"p-dialog",3),J("visibleChange",function(){return t.onCancel()})("onHide",function(){return t.onCancel()}),U(1,cn,22,2,"ng-template",null,0,te)(3,un,8,2,"ng-template",null,1,te),v()),n&2&&(we(Je(7,nn)),y("visible",t.visible())("modal",!0)("closable",!0)("draggable",!1)("resizable",!1))},dependencies:[ut,lt,_t,Te],styles:[".alert-message[_ngcontent-%COMP%]{margin-bottom:var(--space-4)}.lock-details[_ngcontent-%COMP%]   h4[_ngcontent-%COMP%], .workflow-explanation[_ngcontent-%COMP%]   h4[_ngcontent-%COMP%]{display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3);font-size:var(--font-size-md);font-weight:600;color:var(--color-text-secondary)}.icon-warning[_ngcontent-%COMP%]{color:var(--color-warning)}.icon-info[_ngcontent-%COMP%]{color:var(--color-info)}.lock-list[_ngcontent-%COMP%]{margin-top:var(--space-2)}.lock-item[_ngcontent-%COMP%]{transition:all var(--transition-base);padding:var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:var(--space-2);background-color:var(--color-surface-hover)}.lock-item[_ngcontent-%COMP%]:hover{border-color:var(--color-border-strong);box-shadow:var(--shadow-sm)}.lock-item-header[_ngcontent-%COMP%]{display:flex;justify-content:space-between;align-items:flex-start}.lock-level-badge[_ngcontent-%COMP%]{padding:2px var(--space-2);border-radius:var(--radius-sm);font-size:var(--font-size-xs);font-weight:500}.lock-level-readonly[_ngcontent-%COMP%]{background-color:var(--color-warning-bg);color:var(--color-warning)}.lock-level-cannotdelete[_ngcontent-%COMP%]{background-color:var(--color-danger-bg);color:var(--color-danger)}.lock-notes[_ngcontent-%COMP%]{font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-top:var(--space-1)}.workflow-explanation[_ngcontent-%COMP%]{margin-top:var(--space-4)}.workflow-steps[_ngcontent-%COMP%]{list-style-type:decimal;list-style-position:inside;margin-top:var(--space-2);font-size:var(--font-size-sm)}.workflow-steps[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] + li[_ngcontent-%COMP%]{margin-top:var(--space-1)}.security-notice[_ngcontent-%COMP%]{margin-top:var(--space-4)}.modal-footer[_ngcontent-%COMP%]{display:flex;justify-content:flex-end;gap:var(--space-3);padding:var(--space-4) 0 0}.btn[_ngcontent-%COMP%]{display:inline-flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:var(--radius-sm);font-size:var(--font-size-base);font-weight:500;cursor:pointer;border:1px solid transparent;transition:all var(--transition-fast)}.btn[_ngcontent-%COMP%]:disabled{opacity:.6;cursor:not-allowed}.btn-text[_ngcontent-%COMP%]{background:transparent;color:var(--color-text-secondary);border-color:transparent}.btn-text[_ngcontent-%COMP%]:hover:not(:disabled){background:var(--color-surface-hover);color:var(--color-text)}.btn-danger[_ngcontent-%COMP%]{background:var(--color-danger);color:var(--color-text-inverse);border-color:var(--color-danger)}.btn-danger[_ngcontent-%COMP%]:hover:not(:disabled){opacity:.9}"],changeDetection:0})}}return i})();var xt=(()=>{class i{constructor(e,n,t,o){this.azureApiService=e,this.dialogService=n,this.messageService=t,this.appAuditService=o}isScopeLockedError(e){let n=!1,t,o;if(e?.error?.error?.code)t=e.error.error.code,o=e.error.error.message,n=t==="ScopeLocked";else if(e?.error?.code)t=e.error.code,o=e.error.message,n=t==="ScopeLocked";else{let r=e?.message||e?.error?.message||"";n=r.includes("ScopeLocked"),o=r}return n}extractResourceIdFromError(e){let n="";e?.error?.error?.message?n=e.error.error.message:e?.error?.message?n=e.error.message:n=e?.message||"";let t=n.match(/following scope\(s\) are locked: '([^']+)'/);return t?t[1]:null}extractResourceNameFromId(e){if(!e)return"Unknown Resource";let n=e.split("/"),t=n[n.length-1];return e.includes("/storageAccounts/")?`Storage Account: ${t}`:e.includes("/resourceGroups/")?`Resource Group: ${t}`:e.includes("/subscriptions/")?`Subscription: ${t}`:t||"Unknown Resource"}async showLockRemovalConfirmation(e){let n=this.extractResourceNameFromId(e);return new Promise(t=>{this.messageService.clear(),this.messageService.add({key:"lockConfirm",sticky:!0,severity:"warn",summary:"Resource Lock Detected",detail:`The resource "${n}" is locked and cannot be modified. Would you like to temporarily remove the lock to perform the operation? Note: The lock will be recreated after the operation completes.`,closable:!1}),setTimeout(()=>{this.messageService.clear("lockConfirm"),t(!0)},3e3)})}async handleScopeLockedError(e,n){let t=this.extractResourceIdFromError(e);if(!t)throw console.error("Could not extract resource ID from error"),e;if(!await this.showLockRemovalConfirmation(t))throw new Error("Lock removal cancelled by user");return this.executeWithLockManagement(t,n)}handleScopeLockedErrorObservable(e,n,t,o="operation"){let r=this.extractResourceNameFromId(n);return new q(s=>{this.getLocks(n).subscribe({next:c=>{let p={resourceName:r,operationType:o,lockCount:c.length,locks:c.map(u=>({name:u.name,level:u.level,notes:u.notes}))},g=this.dialogService.open(kt,{data:{data:p},header:"Resource Lock Detected",width:"600px",closable:!1,modal:!0});if(!g){s.error(new Error("Failed to open lock confirmation dialog"));return}g.onClose.subscribe(u=>{u==="confirm"?this.executeWithLockManagementObservable(n,t).subscribe({next:C=>{s.next(C),s.complete()},error:C=>{s.error(C)}}):s.error(e)})},error:c=>{console.error("Failed to get locks for confirmation:",c),this.messageService.clear(),this.messageService.add({key:"lockFallback",sticky:!0,severity:"warn",summary:"Resource Lock Detected",detail:`The resource "${r}" is locked and cannot be modified. Proceeding with lock removal for ${o}. Note: The lock will be recreated after the operation completes.`,closable:!1}),setTimeout(()=>{this.messageService.clear("lockFallback"),this.executeWithLockManagementObservable(n,t).subscribe({next:p=>{s.next(p),s.complete()},error:p=>{s.error(p)}})},2e3)}})})}async executeWithLockManagement(e,n){try{let t=await ve(this.getLocks(e));await ve(this.removeLocks(t));let o=await n();return await ve(this.recreateLocks(e,t)),o}catch(t){throw console.error("Error in lock management workflow:",t),t}}executeWithLockManagementObservable(e,n){return this.messageService.add({key:"lockManagement",severity:"info",summary:"Managing resource locks...",detail:"Please wait while we manage the resource locks"}),this.getLocks(e).pipe(m(t=>{let o=t.filter(r=>r.level==="Delete"||r.level==="CanNotDelete");return o.length===0?(this.messageService.clear("lockManagement"),this.messageService.add({severity:"info",summary:"No delete locks found, proceeding with operation"}),n()):this.removeLocks(o).pipe(m(()=>(this.messageService.clear("lockManagement"),this.messageService.add({key:"operation",severity:"info",summary:"Performing operation...",detail:"Please wait while the operation is being performed"}),n().pipe(m(r=>(this.messageService.clear("operation"),this.messageService.add({key:"recreate",severity:"info",summary:"Recreating locks...",detail:"Please wait while we recreate the locks"}),this.recreateLocks(e,o).pipe(d(()=>(this.messageService.clear("recreate"),this.messageService.add({severity:"success",summary:"Operation completed successfully with lock management"}),r)),l(s=>(this.messageService.clear("recreate"),this.messageService.add({severity:"warn",summary:"Operation succeeded but some locks could not be recreated"}),a(r)))))),l(r=>(this.messageService.clear("operation"),this.messageService.add({key:"recreateAfterError",severity:"info",summary:"Recreating locks after failed operation...",detail:"Please wait while we recreate the locks"}),this.recreateLocks(e,o).pipe(m(()=>(this.messageService.clear("recreateAfterError"),k(()=>r))),l(s=>(this.messageService.clear("recreateAfterError"),this.messageService.add({severity:"error",summary:"Operation failed and locks could not be recreated"}),console.error("Failed to recreate locks after operation failure:",s),k(()=>r))))))))),l(r=>(this.messageService.clear("lockManagement"),this.messageService.add({severity:"error",summary:"Failed to remove locks"}),k(()=>r))))}))}getLocks(e){return this.azureApiService.getStorageAccountLocks(e).pipe(d(n=>n.map(r=>({id:r.id,name:r.name,level:r.properties?.level||"ReadOnly",notes:r.properties?.notes})).filter(r=>r.level==="Delete"||r.level==="CanNotDelete")),l(n=>(console.error("Failed to get locks:",n),a([]))))}removeLocks(e){if(e.length===0)return a(null);let n=e.map(t=>this.azureApiService.deleteStorageAccountLock(t.id).pipe($(()=>{this.appAuditService.logAction("lock_removed","storage_account",this.extractResourceIdFromLockId(t.id),`Lock: ${t.name}`,{lockId:t.id,lockName:t.name,lockLevel:t.level==="CanNotDelete"?"Delete":t.level,lockNotes:t.notes},!0)}),d(o=>o),l(o=>(console.error(`Failed to remove lock ${t.name}:`,o),a(null)))));return x(n)}recreateLocks(e,n){let t=n.map(o=>this.azureApiService.createStorageAccountLock(e,o.name,o.level,o.notes||"Recreated by Azure Permission Manager").pipe($(r=>{this.appAuditService.logAction("lock_added","storage_account",e,`Lock: ${o.name}`,{lockName:o.name,lockLevel:o.level==="CanNotDelete"?"Delete":o.level,lockNotes:o.notes||"Recreated by Azure Permission Manager",originalLockId:o.id},!0)}),l(()=>a(null))));return x(t)}extractResourceIdFromLockId(e){let n=e.split("/providers/Microsoft.Authorization/locks/");return n.length>0?n[0]:e}static{this.\u0275fac=function(n){return new(n||i)(N(_e),N(dt),N(rt),N(ke))}}static{this.\u0275prov=F({token:i,factory:i.\u0275fac,providedIn:"root"})}}return i})();var Io=(()=>{class i{constructor(e,n,t,o,r){this.http=e,this.authService=n,this.azureApiService=t,this.lockManagementService=o,this.appAuditService=r,this.graphApiUrl="https://graph.microsoft.com/v1.0",this.managementApiUrl="https://management.azure.com",this.cache=new Map,this.CACHE_DURATION=300*1e3,this.operationQueue=[],this.isProcessingQueue=!1,this.MAX_RETRY_ATTEMPTS=3,this.RETRY_DELAY=2e3,this.pendingPrincipalRequests=new Map,this.pendingStorageAccountRequests=new Map}async getUserPermissions(e){let n=`permissions_${e||"me"}`,t=this.getFromCache(n);if(t)return t;try{let[o,r,s]=await Promise.all([this.getDirectoryRoles(e).toPromise(),this.getAppRoleAssignments(e).toPromise(),this.getRBACPermissions(e).toPromise()]),c={directoryRoles:o||[],appRoles:r||[],rbacRoles:s?.roleAssignments||[],subscriptions:s?.subscriptions||[]};return this.setCache(n,c),c}catch(o){throw this.handleError(o)}}getDirectoryRoles(e){return this.getGraphHeaders().pipe(m(n=>{let t=e?`/users/${e}/memberOf`:"/me/memberOf",o=this.http.get(`${this.graphApiUrl}${t}`,{headers:n}).pipe(d(r=>r.value.filter(s=>s["@odata.type"]==="#microsoft.graph.directoryRole"||s.roleTemplateId).map(s=>({id:s.id,displayName:s.displayName,description:s.description,roleTemplateId:s.roleTemplateId,isBuiltIn:!0}))),l(r=>(console.error("Failed to get directory roles via memberOf:",r),a([]))));if(e){let r=this.http.get(`${this.graphApiUrl}/roleManagement/directory/roleAssignments`,{headers:n,params:new S().set("$filter",`principalId eq '${e}'`).set("$expand","roleDefinition")}).pipe(d(s=>(s.value||[]).map(c=>({id:c.roleDefinition?.id||c.roleDefinitionId,displayName:c.roleDefinition?.displayName||"Unknown Role",description:c.roleDefinition?.description||"",roleTemplateId:c.roleDefinition?.templateId||c.roleDefinitionId,isBuiltIn:c.roleDefinition?.isBuiltIn??!0}))),l(s=>(console.error("Failed to get directory role assignments:",s),a([]))));return x([o,r]).pipe(d(([s,c])=>{let p=new Set,g=[];for(let u of[...s,...c]){let C=u.roleTemplateId||u.id;p.has(C)||(p.add(C),g.push(u))}return g}))}return o}),l(n=>(console.error("Failed to get directory roles:",n),a([]))))}getAppRoleAssignments(e){let n=e?`/users/${e}/appRoleAssignments`:"/me/appRoleAssignments";return this.getGraphHeaders().pipe(m(t=>this.http.get(`${this.graphApiUrl}${n}`,{headers:t,params:new S().set("$select","id,appRoleId,principalId,principalType,resourceId,resourceDisplayName,createdDateTime")})),m(t=>{let o=t.value||[];if(o.length===0)return a([]);let r=o.map(s=>this.enrichAppRoleAssignment(s));return x(r).pipe(l(()=>a(o)))}),l(t=>(console.error("Failed to get app role assignments:",t),a([]))))}getRBACPermissions(e){return this.getManagementHeaders().pipe(m(n=>this.http.get(`${this.managementApiUrl}/subscriptions?api-version=2022-12-01`,{headers:n}).pipe(m(t=>{let o=t.value.map(s=>({subscriptionId:s.subscriptionId,displayName:s.displayName,state:s.state,tenantId:s.tenantId}));return o.length===0?a({roleAssignments:[],subscriptions:[]}):(e?a(e):this.getCurrentUserObjectId()).pipe(m(s=>{let c=o.map(p=>this.getRoleAssignmentsForSubscription(p.subscriptionId,s,n));return x(c).pipe(d(p=>({roleAssignments:p.flat(),subscriptions:o})))}))}))),l(n=>(console.error("Failed to get RBAC permissions:",n),a({roleAssignments:[],subscriptions:[]}))))}getRoleAssignmentsForSubscription(e,n,t){let o=`${this.managementApiUrl}/subscriptions/${e}/providers/Microsoft.Authorization/roleAssignments`,r=new S().set("api-version","2022-04-01").set("$filter",`assignedTo('${n}')`);return this.http.get(o,{headers:t,params:r}).pipe(m(s=>{let c=s.value||[];if(c.length===0)return a([]);let p=c.map(g=>this.enrichRoleAssignment(g,t));return x(p).pipe(l(()=>a(c)))}),l(()=>a([])))}getPermissionSummary(e){return new q(n=>{this.getUserPermissions(e).then(t=>{let o=this.identifyHighPrivilegeRoles(t),r=this.getRecentAssignments(t),s={totalDirectoryRoles:t.directoryRoles.length,totalAppRoles:t.appRoles.length,totalRbacRoles:t.rbacRoles.length,totalSubscriptions:t.subscriptions.length,highPrivilegeRoles:o,recentAssignments:r};n.next(s),n.complete()}).catch(t=>n.error(t))})}filterPermissions(e,n){let t={directoryRoles:[...e.directoryRoles],appRoles:[...e.appRoles],rbacRoles:[...e.rbacRoles],subscriptions:[...e.subscriptions]};if(n.permissionType&&n.permissionType!=="all")switch(n.permissionType){case"directory":t.appRoles=[],t.rbacRoles=[];break;case"application":t.directoryRoles=[],t.rbacRoles=[];break;case"rbac":t.directoryRoles=[],t.appRoles=[];break}if(n.subscriptionId&&(t.rbacRoles=t.rbacRoles.filter(o=>o.properties.scope.includes(n.subscriptionId))),n.searchQuery){let o=n.searchQuery.toLowerCase();t.directoryRoles=t.directoryRoles.filter(r=>r.displayName.toLowerCase().includes(o)),t.appRoles=t.appRoles.filter(r=>r.resourceDisplayName.toLowerCase().includes(o)||r.appRoleDisplayName&&r.appRoleDisplayName.toLowerCase().includes(o)),t.rbacRoles=t.rbacRoles.filter(r=>r.properties.roleDefinitionName&&r.properties.roleDefinitionName.toLowerCase().includes(o)||r.properties.scopeDisplayName&&r.properties.scopeDisplayName.toLowerCase().includes(o))}return t}exportPermissions(e,n,t){let o=this.convertPermissionsToCSV(e,n,t);return new Blob([o],{type:"text/csv;charset=utf-8;"})}getGraphHeaders(){return this.authService.getAccessToken(["https://graph.microsoft.com/.default"]).pipe(D(1e4),d(e=>new Me({Authorization:`Bearer ${e}`,"Content-Type":"application/json"})),l(e=>(console.error("\u{1F510} Failed to get Graph API access token:",e),this.authService.isAuthenticated()?k(()=>this.handleError(e)):(console.error("\u{1F510} User is not authenticated - redirecting to login"),this.authService.login(),k(()=>new L("Authentication required. Please log in again.","AUTHENTICATION_REQUIRED",401))))))}getManagementHeaders(){return this.authService.getAccessToken(["https://management.azure.com/.default"]).pipe(D(1e4),d(e=>new Me({Authorization:`Bearer ${e}`,"Content-Type":"application/json"})),l(e=>(console.error("\u{1F510} Failed to get Management API access token:",e),this.authService.isAuthenticated()?k(()=>this.handleError(e)):(console.error("\u{1F510} User is not authenticated - redirecting to login"),this.authService.login(),k(()=>new L("Authentication required. Please log in again.","AUTHENTICATION_REQUIRED",401))))))}getCurrentUserObjectId(){return this.getGraphHeaders().pipe(m(e=>this.http.get(`${this.graphApiUrl}/me`,{headers:e,params:new S().set("$select","id")})),d(e=>e.id))}enrichAppRoleAssignment(e){return this.getGraphHeaders().pipe(m(n=>this.http.get(`${this.graphApiUrl}/servicePrincipals/${e.resourceId}`,{headers:n,params:new S().set("$select","displayName,appRoles")})),d(n=>{let t=n.appRoles?.find(o=>o.id===e.appRoleId);return fe(j({},e),{appDisplayName:n.displayName,appRoleDisplayName:t?.displayName,appRoleDescription:t?.description})}),l(()=>a(e)))}enrichRoleAssignment(e,n){let t=`${this.managementApiUrl}${e.properties.roleDefinitionId}?api-version=2022-04-01`;return this.http.get(t,{headers:n}).pipe(d(o=>fe(j({},e),{properties:fe(j({},e.properties),{roleDefinitionName:o.properties.roleName,scopeDisplayName:this.getScopeDisplayName(e.properties.scope),scopeType:this.getScopeType(e.properties.scope)})})),l(()=>a(e)))}getScopeDisplayName(e){let n=e.split("/");if(n.includes("subscriptions")){let t=n.indexOf("subscriptions");return n[t+2]==="resourceGroups"?n[t+3]:n[t+1]}return e}getScopeType(e){let n=e.split("/");return n.includes("resourceGroups")?n.length>n.indexOf("resourceGroups")+2?"Resource":"ResourceGroup":"Subscription"}identifyHighPrivilegeRoles(e){let n=[],t=["Global Administrator","Privileged Role Administrator","Security Administrator","User Administrator"];return e.directoryRoles.forEach(o=>{t.includes(o.displayName)&&n.push(o.displayName)}),e.rbacRoles.forEach(o=>{(o.properties.roleDefinitionName==="Owner"||o.properties.roleDefinitionName==="User Access Administrator")&&n.push(o.properties.roleDefinitionName||"Unknown Role")}),[...new Set(n)]}getRecentAssignments(e){let n=[];return e.rbacRoles.sort((t,o)=>new Date(o.properties.createdOn).getTime()-new Date(t.properties.createdOn).getTime()).slice(0,3).forEach(t=>{n.push({roleName:t.properties.roleDefinitionName||"Unknown Role",resourceName:t.properties.scopeDisplayName||"Unknown Resource",assignedDate:new Date(t.properties.createdOn),type:"RBAC"})}),e.appRoles.sort((t,o)=>new Date(o.createdDateTime).getTime()-new Date(t.createdDateTime).getTime()).slice(0,2).forEach(t=>{n.push({roleName:t.appRoleDisplayName||"App Role",resourceName:t.resourceDisplayName,assignedDate:new Date(t.createdDateTime),type:"Application"})}),n.slice(0,5)}convertPermissionsToCSV(e,n,t){let r=[["Type","Role Name","Resource/Scope","Assigned Date","Description"].join(",")];return e.directoryRoles.forEach(s=>{r.push(["Directory Role",`"${s.displayName}"`,"Tenant-wide","",`"${s.description||""}"`].join(","))}),e.appRoles.forEach(s=>{r.push(["Application Role",`"${s.appRoleDisplayName||"App Role"}"`,`"${s.resourceDisplayName}"`,new Date(s.createdDateTime).toLocaleDateString(),`"${s.appRoleDescription||""}"`].join(","))}),e.rbacRoles.forEach(s=>{r.push(["RBAC Role",`"${s.properties.roleDefinitionName||"Unknown Role"}"`,`"${s.properties.scopeDisplayName||s.properties.scope}"`,new Date(s.properties.createdOn).toLocaleDateString(),""].join(","))}),r.join(`
`)}setCache(e,n,t){let o=t||this.CACHE_DURATION;this.cache.set(e,{data:n,expiry:Date.now()+o})}getFromCache(e){let n=this.cache.get(e);return!n||Date.now()>n.expiry?(this.cache.delete(e),null):n.data}handleError(e){return console.error("\u{1F6A8} PermissionsService error:",e),e.name==="TimeoutError"||e.message?.includes("timeout")?new L("Request timed out. Please check your connection and try again.","TIMEOUT_ERROR",408):e.status===401||e.code==="AUTHENTICATION_REQUIRED"?new L("Authentication required. Please log in again.","AUTHENTICATION_REQUIRED",401):e.status===403?new L("Insufficient permissions to access this resource","INSUFFICIENT_PERMISSIONS",403):e.status===0||!e.status?new L("Network error. Please check your connection and try again.","NETWORK_ERROR",0):e.status===429?new L("Too many requests. Please wait a moment and try again.","RATE_LIMITED",429):new L(e.message||"Failed to fetch permissions","API_ERROR",e.status||500)}removeStorageAccountPermission(e,n,t){return this.azureApiService.removeStorageAccountRoleAssignment(e,t).pipe($(o=>{o&&o.success&&(this.clearStorageAccountCache(n),this.clearCache())}),l(o=>(console.error("Failed to remove storage account permission:",o),k(()=>o))))}clearStorageAccountCache(e){let n=[],t=e.match(/\/storageAccounts\/([^\/]+)/),o=t?t[1]:null;this.cache.forEach((r,s)=>{(s.includes("storage_account_permissions")||s.includes("role_assignments")||o&&s.includes(o))&&n.push(s)}),n.forEach(r=>{this.cache.delete(r)})}clearCache(){this.cache.clear()}searchResources(e){return this.getManagementHeaders().pipe(m(n=>this.http.get(`${this.managementApiUrl}/subscriptions?api-version=2022-12-01`,{headers:n}).pipe(m(t=>{let o=t.value||[];if(o.length===0)return a([]);let r=o.map(s=>{let c=`${this.managementApiUrl}/subscriptions/${s.subscriptionId}/resources`,p=new S().set("api-version","2021-04-01").set("$filter",`substringof('${e}', name)`).set("$top","20");return this.http.get(c,{headers:n,params:p}).pipe(d(g=>(g.value||[]).map(u=>({id:u.id,name:u.name,type:this.friendlyResourceType(u.type),rawType:u.type,resourceGroup:this.extractResourceGroupFromId(u.id),subscriptionId:s.subscriptionId,location:u.location}))),l(()=>a([])))});return x(r).pipe(d(s=>{let c=s.flat(),p=e.toLowerCase();return c.filter(g=>g.name.toLowerCase().includes(p)).slice(0,50)}))}))),l(n=>(console.error("Failed to search resources:",n),a([]))))}getRoleDefinitionsForScope(e){return this.getManagementHeaders().pipe(m(n=>{let t=`${this.managementApiUrl}${e}/providers/Microsoft.Authorization/roleDefinitions`,o=new S().set("api-version","2022-04-01");return this.http.get(t,{headers:n,params:o}).pipe(d(r=>{let s=(r.value||[]).map(p=>({id:p.id,name:p.properties.roleName,description:p.properties.description,type:p.properties.type==="BuiltInRole"?"builtin":"custom"})),c=["Owner","Contributor","Reader","User Access Administrator","Storage Blob Data Owner","Storage Blob Data Contributor","Storage Blob Data Reader","Storage Account Contributor","Storage Account Key Operator Service Role"];return s.sort((p,g)=>{let u=c.indexOf(p.name),C=c.indexOf(g.name);return u!==-1&&C!==-1?u-C:u!==-1?-1:C!==-1?1:p.name.localeCompare(g.name)})}))}),l(n=>(console.error("Failed to get role definitions for scope:",n),a([]))))}friendlyResourceType(e){return{"Microsoft.Storage/storageAccounts":"Storage Account","Microsoft.Compute/virtualMachines":"Virtual Machine","Microsoft.Web/sites":"App Service","Microsoft.Sql/servers":"SQL Server","Microsoft.Sql/servers/databases":"SQL Database","Microsoft.KeyVault/vaults":"Key Vault","Microsoft.Network/virtualNetworks":"Virtual Network","Microsoft.Network/networkSecurityGroups":"Network Security Group","Microsoft.Network/publicIPAddresses":"Public IP Address","Microsoft.Network/loadBalancers":"Load Balancer","Microsoft.ContainerService/managedClusters":"AKS Cluster","Microsoft.DocumentDB/databaseAccounts":"Cosmos DB","Microsoft.Cache/Redis":"Redis Cache","Microsoft.ServiceBus/namespaces":"Service Bus","Microsoft.EventHub/namespaces":"Event Hub"}[e]||e.split("/").pop()||e}getResourceGroups(e){let n=`resource_groups_${e}`,t=this.getFromCache(n);return t?a(t):this.getManagementHeaders().pipe(m(o=>{let r=`${this.managementApiUrl}/subscriptions/${e}/resourcegroups`,s=new S().set("api-version","2022-09-01");return this.http.get(r,{headers:o,params:s})}),d(o=>{let r=o.value||[];return this.setCache(n,r,300*1e3),r}),l(o=>(console.error("Failed to get resource groups:",o),a([]))))}getStorageAccounts(e){let n=`storage_accounts_${e}`,t=this.getFromCache(n);return t?a(t):this.getManagementHeaders().pipe(m(o=>{let r=`${this.managementApiUrl}/subscriptions/${e}/providers/Microsoft.Storage/storageAccounts`,s=new S().set("api-version","2023-01-01");return this.http.get(r,{headers:o,params:s})}),d(o=>{let r=o.value.map(s=>({id:s.id,name:s.name,type:s.type,location:s.location,resourceGroup:this.extractResourceGroupFromId(s.id),subscriptionId:e,properties:{primaryEndpoints:s.properties?.primaryEndpoints,creationTime:s.properties?.creationTime||new Date().toISOString(),provisioningState:s.properties.provisioningState,accountType:s.properties.accountType||s.sku?.name,accessTier:s.properties.accessTier,supportsHttpsTrafficOnly:s.properties.supportsHttpsTrafficOnly},tags:s.tags}));return this.setCache(n,r),r}),l(o=>(console.error("Failed to get storage accounts:",o),k(()=>new xe("Failed to fetch storage accounts","FETCH_ERROR",o.status)))))}getStorageAccountsWithPermissions(e,n){return this.getStorageAccounts(e).pipe(m(t=>{let o=t;return n&&(o=this.applyStorageAccountFilters(t,n)),this.processStorageAccountsInBatches(o)}))}processStorageAccountsInBatches(e,n=5){if(e.length===0)return a([]);let t=[];for(let o=0;o<e.length;o+=n)t.push(e.slice(o,o+n));return Ne(t).pipe(Ee((o,r)=>{let s=o.map(p=>this.getStorageAccountRoleAssignments(p.id).pipe(d(g=>({storageAccount:p,roleAssignments:g})),l(()=>a({storageAccount:p,roleAssignments:[]}))));return(r>0?Pe(500):a(0)).pipe(m(()=>s.length>0?x(s):a([])))}),$e((o,r)=>[...o,...r],[]),Le(1))}getSubscriptionRoleAssignments(e){let n=`subscription_role_assignments_${e}`,t=this.getFromCache(n);return t?a(t):this.getManagementHeaders().pipe(m(o=>{let r=`${this.managementApiUrl}/subscriptions/${e}/providers/Microsoft.Authorization/roleAssignments`,s=new S().set("api-version","2022-04-01");return this.http.get(r,{headers:o,params:s}).pipe(D(3e4))}),d(o=>{let r=o.value||[];return this.setCache(n,r,300*1e3),r}),l(o=>(console.error("Failed to get subscription-level role assignments:",o),a([]))))}getSubscriptionRoleDefinitions(e){let n=`subscription_role_definitions_${e}`,t=this.getFromCache(n);return t?a(t):this.getManagementHeaders().pipe(m(o=>{let r=`${this.managementApiUrl}/subscriptions/${e}/providers/Microsoft.Authorization/roleDefinitions`,s=new S().set("api-version","2022-04-01");return this.http.get(r,{headers:o,params:s}).pipe(D(3e4))}),d(o=>{let r=o.value||[],s=new Map;return r.forEach(c=>{s.set(c.id,c)}),this.setCache(n,s,600*1e3),s}),l(o=>(console.error("Failed to get subscription-level role definitions:",o),a(new Map))))}batchLoadStorageAccountPermissions(e,n){return x({assignments:this.getSubscriptionRoleAssignments(e),roleDefinitions:this.getSubscriptionRoleDefinitions(e)}).pipe(m(({assignments:t,roleDefinitions:o})=>{let r=new Set(n.map(u=>u.toLowerCase())),s=t.filter(u=>{let C=(u.properties?.scope||"").toLowerCase();return r.has(C)||n.some(H=>H.toLowerCase().startsWith(C))}),p=[...new Set(s.map(u=>u.properties.principalId))].map(u=>this.getPrincipalDetails(u).pipe(d(C=>({id:u,details:C})),l(()=>a({id:u,details:{displayName:`Unknown (${u.substring(0,8)}...)`,principalType:"Unknown"}}))));return(p.length>0?x(p):a([])).pipe(d(u=>{let C=new Map;u.forEach(_=>C.set(_.id,_.details));let H=new Map;return n.forEach(_=>H.set(_,[])),s.forEach(_=>{let se=_.properties.scope||"",De=_.properties.roleDefinitionId||"",At=o.get(De),he=C.get(_.properties.principalId),Rt={id:_.id,name:_.name,type:_.type,properties:{roleDefinitionId:De,roleDefinitionName:At?.properties?.roleName||"Unknown Role",principalId:_.properties.principalId,principalType:_.properties.principalType||he?.principalType||"Unknown",principalDisplayName:he?.displayName||`Unknown (${_.properties.principalId.substring(0,8)}...)`,principalEmail:he?.mail||he?.userPrincipalName,scope:se,createdOn:_.properties.createdOn,updatedOn:_.properties.updatedOn}};n.filter(ae=>ae.toLowerCase()===se.toLowerCase()||ae.toLowerCase().startsWith(se.toLowerCase())).forEach(ae=>{let Ie=H.get(ae)||[];Ie.push(Rt),H.set(ae,Ie)})}),H.forEach((_,se)=>{this.setCache(`storage_account_assignments_${se}`,_,300*1e3)}),H}))}),l(t=>(console.error("Failed to batch-load storage account permissions:",t),a(new Map))))}getStorageAccountRoleAssignments(e){let n=`storage_account_assignments_${e}`,t=this.getFromCache(n);if(t)return a(t);let o=this.pendingStorageAccountRequests.get(e);if(o)return o;let r=this.getManagementHeaders().pipe(m(s=>{let c=`${this.managementApiUrl}${e}/providers/Microsoft.Authorization/roleAssignments`,p=new S().set("api-version","2022-04-01");return this.http.get(c,{headers:s,params:p}).pipe(D(15e3))}),m(s=>{let c=s.value||[],p=c.map(g=>this.enrichStorageAccountRoleAssignment(g));return x(p).pipe(l(()=>a(c.map(g=>this.mapToStorageAccountRoleAssignment(g)))))}),$(s=>{this.setCache(n,s,300*1e3),this.pendingStorageAccountRequests.delete(e)}),l(s=>(console.error("Failed to get storage account role assignments:",s),this.pendingStorageAccountRequests.delete(e),a([]))),Fe());return this.pendingStorageAccountRequests.set(e,r),r}getStorageAccountSummary(e){return this.getStorageAccountsWithPermissions(e).pipe(d(n=>{let t=n.length,o=n.reduce((p,g)=>p+g.roleAssignments.length,0),r={};n.forEach(p=>{let g=p.storageAccount.location;r[g]=(r[g]||0)+1});let s={};n.forEach(p=>{p.roleAssignments.forEach(g=>{let u=g.properties.roleDefinitionName;s[u]=(s[u]||0)+1})});let c=this.getRecentStorageAssignments(n);return{totalStorageAccounts:t,totalRoleAssignments:o,storageAccountsByLocation:r,roleDistribution:s,recentAssignments:c}}))}applyStorageAccountFilters(e,n){let t=[...e];if(n.resourceGroup&&(t=t.filter(o=>o.resourceGroup.toLowerCase().includes(n.resourceGroup.toLowerCase()))),n.searchQuery){let o=n.searchQuery.toLowerCase();t=t.filter(r=>r.name.toLowerCase().includes(o)||r.resourceGroup.toLowerCase().includes(o)||r.location.toLowerCase().includes(o))}return n.location&&(t=t.filter(o=>o.location.toLowerCase()===n.location.toLowerCase())),n.accountType&&(t=t.filter(o=>o.properties.accountType?.toLowerCase().includes(n.accountType.toLowerCase()))),t}enrichStorageAccountRoleAssignment(e){let n=`enriched_assignment_${e.id}`,t=this.getFromCache(n);return t?a(t):this.getManagementHeaders().pipe(m(o=>{let r=`role_def_${e.properties.roleDefinitionId}`,s=this.getFromCache(r),c=s?a(s):this.http.get(`${this.managementApiUrl}${e.properties.roleDefinitionId}?api-version=2022-04-01`,{headers:o}).pipe(D(1e4),$(g=>this.setCache(r,g)),l(()=>a(null))),p=this.getPrincipalDetails(e.properties.principalId);return x({roleDef:c,principal:p})}),d(({roleDef:o,principal:r})=>{let s={id:e.id,name:e.name,type:e.type,properties:{roleDefinitionId:e.properties.roleDefinitionId,roleDefinitionName:o?.properties?.roleName||"Unknown Role",principalId:e.properties.principalId,principalType:e.properties.principalType,principalDisplayName:r?.displayName||`Unknown Principal (${e.properties.principalId.substring(0,8)}...)`,principalEmail:r?.mail||r?.userPrincipalName,scope:e.properties.scope,createdOn:e.properties.createdOn,updatedOn:e.properties.updatedOn}};return this.setCache(n,s),s}),l(()=>{let o=this.mapToStorageAccountRoleAssignment(e);return this.setCache(n,o),a(o)}))}resolvePrincipal(e){return this.getPrincipalDetails(e)}getPrincipalDetails(e){let n=`principal_${e}`,t=this.getFromCache(n);if(t)return a(t);let o=`principal_failure_${e}`;if(this.getFromCache(o)){let p={id:e,displayName:`Unknown Principal (${e.substring(0,8)}...)`,principalType:"Unknown"};return this.setCache(n,p),a(p)}let s=this.pendingPrincipalRequests.get(e);if(s)return s;let c=this.getGraphHeaders().pipe(m(p=>this.tryGetPrincipalWithBatch(e,p)),Ue(1),Oe(()=>{this.pendingPrincipalRequests.delete(e)}));return this.pendingPrincipalRequests.set(e,c),c}tryGetPrincipalWithBatch(e,n){let t=`principal_${e}`,o=`principal_failure_${e}`;if(!this.isValidPrincipalId(e)){let r={id:e,displayName:`Invalid Principal ID (${e.substring(0,8)}...)`,principalType:"Unknown"};return this.setCache(t,r),this.setCache(o,!0,3e5),a(r)}return this.makeGraphRequest(`users/${e}`,n,"id,displayName,mail,userPrincipalName").pipe(d(r=>(r.principalType="User",r.isDeleted=!1,this.setCache(t,r),r)),l(r=>r.status===404?this.makeGraphRequest(`servicePrincipals/${e}`,n,"id,displayName,appDisplayName").pipe(d(s=>(s.principalType="ServicePrincipal",s.isDeleted=!1,this.setCache(t,s),s)),l(s=>s.status===404?this.makeGraphRequest(`groups/${e}`,n,"id,displayName,mail").pipe(d(c=>(c.principalType="Group",c.isDeleted=!1,this.setCache(t,c),c)),l(c=>this.handlePrincipalNotFound(e,t,o))):this.handlePrincipalError(e,t,o,s))):this.handlePrincipalError(e,t,o,r)))}makeGraphRequest(e,n,t){return this.http.get(`${this.graphApiUrl}/${e}`,{headers:n,params:new S().set("$select",t)}).pipe(D(1e4),l(o=>o.status===404?k(()=>o):o.name==="TimeoutError"?k(()=>new Error("Request timed out")):k(()=>o)))}isValidPrincipalId(e){return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e)}handlePrincipalNotFound(e,n,t){this.setCache(t,!0,3e5);let o={id:e,displayName:`Deleted Principal (${e.substring(0,8)}...)`,principalType:"Unknown",isDeleted:!0};return this.setCache(n,o),a(o)}handlePrincipalError(e,n,t,o){this.setCache(t,!0,3e5);let r={id:e,displayName:`Error Loading Principal (${e.substring(0,8)}...)`,principalType:"Unknown",isDeleted:!1,hasError:!0};return this.setCache(n,r),a(r)}mapToStorageAccountRoleAssignment(e){return{id:e.id,name:e.name,type:e.type,properties:{roleDefinitionId:e.properties.roleDefinitionId,roleDefinitionName:"Unknown Role",principalId:e.properties.principalId,principalType:e.properties.principalType,principalDisplayName:"Unknown Principal",scope:e.properties.scope,createdOn:e.properties.createdOn,updatedOn:e.properties.updatedOn}}}extractResourceGroupFromId(e){let n=e.split("/"),t=n.indexOf("resourceGroups");return t!==-1&&t+1<n.length?n[t+1]:"Unknown"}getRecentStorageAssignments(e){let n=[];return e.forEach(t=>{t.roleAssignments.forEach(o=>{n.push({storageAccountName:t.storageAccount.name,principalName:o.properties.principalDisplayName,roleName:o.properties.roleDefinitionName,assignedDate:new Date(o.properties.createdOn),resourceGroup:t.storageAccount.resourceGroup})})}),n.sort((t,o)=>o.assignedDate.getTime()-t.assignedDate.getTime()).slice(0,5)}assignStorageAccountPermission(e){return this.getManagementHeaders().pipe(m(n=>{let t=this.generateGuid(),o=`${this.managementApiUrl}${e.storageAccountId}/providers/Microsoft.Authorization/roleAssignments/${t}?api-version=2022-04-01`,r={properties:{roleDefinitionId:e.roleDefinitionId,principalId:e.principalId,principalType:e.principalType}};return this.http.put(o,r,{headers:n}).pipe($(s=>{this.appAuditService.logAction("permission_added","storage_account",e.storageAccountId,"Storage Account Permission",{principalId:e.principalId,principalType:e.principalType,roleDefinitionId:e.roleDefinitionId,assignmentId:t,assignmentUrl:o},!0)}),l(s=>(console.error("Failed to assign storage account permission:",s),k(()=>this.handleError(s)))))}))}bulkAssignStorageAccountPermissions(e){return this.queueOperation(()=>{let n=e.map(t=>this.assignStorageAccountPermission(t).pipe(d(o=>({success:!0,result:o,request:t})),l(o=>a({success:!1,error:o,request:t}))));return x(n)})}bulkRemoveStorageAccountPermissions(e){return this.queueOperation(()=>{let n=e.map(t=>this.removeStorageAccountPermissionWithLockHandling(t.assignmentId,t.storageAccountId,t.subscriptionId).pipe(d(o=>({success:!0,result:o,assignment:t})),l(o=>a({success:!1,error:o,assignment:t}))));return x(n).pipe($(t=>{let o=t.filter(s=>s.success).length,r=t.filter(s=>!s.success).length;this.appAuditService.logAction("bulk_permissions_removed","storage_account","multiple",`Bulk Permission Removal (${e.length} items)`,{totalRequests:e.length,successful:o,failed:r,assignments:e.map(s=>({assignmentId:s.assignmentId,storageAccountId:s.storageAccountId}))},!1)}))})}clearPrincipalCache(){let e=[];this.cache.forEach((n,t)=>{(t.startsWith("principal_")||t.startsWith("enriched_assignment_"))&&e.push(t)}),e.forEach(n=>this.cache.delete(n)),this.pendingPrincipalRequests.clear()}getCacheStats(){let e=0;return this.cache.forEach((n,t)=>{t.startsWith("principal_")&&e++}),{totalEntries:this.cache.size,principalEntries:e,pendingRequests:this.pendingPrincipalRequests.size}}getStorageAccountLocks(e){return this.getManagementHeaders().pipe(m(n=>{let t=`${this.managementApiUrl}${e}/providers/Microsoft.Authorization/locks?api-version=2020-05-01`;return this.http.get(t,{headers:n}).pipe(d(o=>o.value||[]),l(o=>(console.error("Failed to get storage account locks:",o),a([]))))}))}temporarilyRemoveLocks(e,n){let t=e.map(o=>{let r=`${this.managementApiUrl}${o.id}?api-version=2020-05-01`;return this.http.delete(r,{headers:n}).pipe(D(1e4),l(()=>a(null)))});return x(t)}recreateLocks(e,n){let t=e.map(o=>{let r=`${this.managementApiUrl}${o.id}?api-version=2020-05-01`,s={properties:{level:o.properties.level,notes:o.properties.notes||"Recreated after permission operation"}};return this.http.put(r,s,{headers:n}).pipe(D(1e4),l(()=>a(null)))});return x(t)}removeRoleAssignment(e,n){let t=`${this.managementApiUrl}${e}?api-version=2022-04-01`;return this.http.delete(t,{headers:n}).pipe(D(15e3),l(o=>(console.error("Failed to remove role assignment:",o),k(()=>this.handleError(o)))))}generateGuid(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){let n=Math.random()*16|0;return(e==="x"?n:n&3|8).toString(16)})}extractStorageAccountIdFromAssignmentId(e){let n=e.split("/providers/Microsoft.Authorization/roleAssignments/");return n.length>0?n[0]:e}removeStorageAccountRoleAssignment(e){return this.getManagementHeaders().pipe(m(n=>{let t=`${this.managementApiUrl}${e}?api-version=2022-04-01`;return this.http.delete(t,{headers:n}).pipe(D(15e3),$(()=>{this.clearStorageAccountCache(e),this.appAuditService.logAction("permission_removed","storage_account",this.extractStorageAccountIdFromAssignmentId(e),"Storage Account Permission",{assignmentId:e,assignmentUrl:t},!0)}),l(o=>(console.error("\u274C Failed to remove storage account role assignment:",o),k(()=>o))))}))}removeStorageAccountPermissionWithLockHandling(e,n,t){return this.azureApiService.removeStorageAccountRoleAssignment(e,t).pipe(l(o=>{if(this.lockManagementService.isScopeLockedError(o)){let r=this.lockManagementService.extractResourceIdFromError(o);return r?this.lockManagementService.handleScopeLockedErrorObservable(o,r,()=>this.azureApiService.removeStorageAccountRoleAssignment(e,t),"permission removal"):(console.error("\u274C Could not extract resource ID from ScopeLocked error"),k(()=>o))}return this.queueOperation(()=>this.azureApiService.removeStorageAccountRoleAssignment(e,t))}))}queueOperation(e){return new q(n=>{this.operationQueue.push({operation:e,resolve:t=>n.next(t),reject:t=>n.error(t)}),this.processQueue()})}processQueue(){if(this.isProcessingQueue||this.operationQueue.length===0)return;this.isProcessingQueue=!0;let e=this.operationQueue.shift();this.executeWithRetry(e.operation,this.MAX_RETRY_ATTEMPTS).subscribe({next:n=>{e.resolve(n),this.isProcessingQueue=!1,this.processQueue()},error:n=>{e.reject(n),this.isProcessingQueue=!1,this.processQueue()}})}executeWithRetry(e,n){return e().pipe(l(t=>{if(this.lockManagementService.isScopeLockedError(t))throw t;if((t.status===409||t.error?.code==="ConflictError"||t.message?.includes("conflict")||t.message?.includes("only one modification"))&&n>1)return new q(r=>{setTimeout(()=>{this.executeWithRetry(e,n-1).subscribe(r)},this.RETRY_DELAY)});throw t}))}static{this.\u0275fac=function(n){return new(n||i)(N(ot),N(it),N(_e),N(xt),N(ke))}}static{this.\u0275prov=F({token:i,factory:i.\u0275fac,providedIn:"root"})}}return i})();export{Dt as a,Sn as b,Pt as c,Un as d,L as e,xe as f,Te as g,_t as h,xt as i,Io as j};
