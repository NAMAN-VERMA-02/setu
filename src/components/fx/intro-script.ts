/** Runs before first paint so returning visitors in the same tab never see the intro. */
export const INTRO_SCRIPT = `try{if(sessionStorage.getItem('setu-intro'))document.documentElement.dataset.seen='1'}catch(e){}`;
