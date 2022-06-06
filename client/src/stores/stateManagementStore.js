import { writable } from "svelte/store";
import { user } from "./userStore.js";


export const playerMovement = writable(false);
