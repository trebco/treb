/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

/**
 * this is our main file for building and generating API types.
 * 
 * because we're using a custom element, we have a class that inherits from 
 * HTMLElement. that's fine, but it means the build output can't be used in 
 * a node environment (for testing, for example) without a shim.
 * 
 * we may add some separate build targets that exclude the html 
 * element for that purpose in the future.
 */

export { TREB, TREBGlobal } from './custom-element/treb-global';

// import for side effects
import './custom-element/treb-spreadsheet-element';

