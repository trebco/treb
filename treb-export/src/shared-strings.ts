
import * as ElementTree from 'elementtree';
import { Element, ElementTree as Tree } from 'elementtree';

export class SharedStrings {

  public dom?: Tree;
  public map: {[index: string]: number} = {};
  public len = 0;

  // reverse map is undefined by default, so it won't be used when
  // constructing. it should only be used when reading.

  public reverse_map?: string[] = undefined;

  /**
   * get string by index (mapped in reverse)
   */
  public GetSharedString(index: number){

    if (this.reverse_map) {
      const check = this.reverse_map[index];
      if (typeof check !== undefined) {
        return check;
      }
    }

    for (const key of Object.keys(this.map)){
      if (this.map[key] === index) return key;
    }
    return undefined;
  }

  /**
   * either add this string to the table or find an existing match.
   * return the index.
   */
  public Ensure(s: string) { // }, format){

    let index = this.map[s];

    if (typeof(index) !== 'undefined' ){
      return index;
    }

    index = this.len++;
    this.map[s] = index;

    /*
    if( /<(b|u|i|div|p|br)>/i.test(s)){
      let nodes = this.tokenizeString(s);

      let si = et.SubElement( this.strings.dom._root, "si" );
      nodes.forEach(function(node){

        let r = et.SubElement( si, "r" );
        if( node.state.b || node.state.u || node.state.i || format){
          let rpr = et.SubElement( r, "rPr" );
          if( node.state.b ) et.SubElement( rpr, "b" );
          if( node.state.i ) et.SubElement( rpr, "i" );
          if( node.state.u ) et.SubElement( rpr, "u" );

          if( format ){
            let clone = cloneElement(format);
            clone._children.forEach(child => {
              rpr.append(child);
            });
          }

        }
        let t = et.SubElement( r, "t" );
        if( /^\s/.test(node.text) || /\s$/.test(node.text) || /\n/.test(node.text))
          t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve");
        t.text = node.text;
  
      }, this);

    }
    else 
    */
    {
      const si = ElementTree.SubElement((this.dom as any)._root, 'si' );
      const t = ElementTree.SubElement(si, 't' );
      t.text = s;
    }

    (this.dom as any)._root.attrib.count =
      (this.dom as any)._root.attrib.uniqueCount = index + 1;

    return index;

  }


}
