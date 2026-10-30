import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {DeckyResponsiveGameTitle} from '../src/platform/decky/decky-responsive-game-title';
import {buildFullScreenGameSections,getAdjacentFullScreenGameSectionId} from '../src/platform/decky/decky-full-screen-game-section-navigation';
import {handleDeckyFullScreenFooterShoulderButtonDown} from '../src/platform/decky/decky-full-screen-footer-overlay';

test('QAM game titles wrap without a two-line truncation even before measurement',()=>{
 const title="Tony Hawk's Underground [Subset - RAdical Custom Goals & Gaps]";
 const html=renderToStaticMarkup(createElement(DeckyResponsiveGameTitle,{title,preferredFontSize:16,minimumFontSize:14,style:{overflow:'hidden',WebkitLineClamp:2}}));
 assert.match(html,/overflow:visible/);assert.match(html,/-webkit-line-clamp:unset/);assert.match(html,/white-space:normal/);assert.match(html,/RAdical Custom Goals/);
});

test('Community section entry target belongs to the persistent page, not its asynchronous ready branch',()=>{
 const page=readFileSync('src/platform/decky/decky-full-screen-game-page.tsx','utf8');
 assert.match(page,/<DeckyFullScreenGameSpotlightFocusTarget\s+focusTargetId=\{RETROACHIEVEMENTS_COMMUNITY_SECTION_FOCUS_TARGET\}[\s\S]*?<DeckyRetroAchievementsCommunityResource snapshot=\{snapshot\} sectionOwnsFocus \/>[\s\S]*?<\/DeckyFullScreenGameSpotlightFocusTarget>/);
 const resource=readFileSync('src/platform/decky/decky-retroachievements-community-resource.tsx','utf8');
 assert.match(resource,/focusable=\{!sectionOwnsFocus\}/);
});

test('existing footer handles adjacent Community navigation and rapid inputs exactly once',()=>{
 const sections=buildFullScreenGameSections({provider:'retroachievements'});
 let active=sections[0]!.id,actions=0;
 const press=(button:number,repeat=false)=>handleDeckyFullScreenFooterShoulderButtonDown({detail:{button,source:0,is_repeat:repeat},preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}},{onNext(){actions++;active=getAdjacentFullScreenGameSectionId(sections,active,'next')},onPrevious(){actions++;active=getAdjacentFullScreenGameSectionId(sections,active,'previous')}});
 press(6);assert.equal(active,'achievements');press(6);assert.equal(active,'community');
 press(5);assert.equal(active,'achievements');press(6);assert.equal(active,'community');
 press(6);assert.equal(active,'overview');press(5);assert.equal(active,'community');
 press(5,true);assert.equal(active,'community');assert.equal(actions,6);
 for(let i=0;i<5;i++){press(5);assert.equal(active,'achievements');press(6);assert.equal(active,'community')}
 assert.equal(actions,16);
});
