/** Runs before first paint so the saved (or system) theme never flashes the wrong colours. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('setu-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;
