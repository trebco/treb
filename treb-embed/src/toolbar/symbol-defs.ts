
//
// NOTE: this file has been manually updated. please don't overwrite!
//
// (1) added double-bottom border
// (2) corrected (slightly) bottom border
// (3) added target class to all borders
// (4) fixed quotes, so lint will shut up
// (5) manually merged some paths
//

export interface PathDef {
  d: string;
  style?: string;
  classes?: string|string[];
}

export interface SymbolDef {
  viewbox?: string;
  paths?: PathDef[];
}

export const symbol_defs: {[index: string]: SymbolDef} = 
{
  'vertical-dots': {
    'paths': [
      {
        'd': 'M12,12 M12,11 A1,1,0,0,1,13,12 A1,1,0,0,1,12,13 A1,1,0,0,1,11,12 A1,1,0,0,1,12,11',
        'classes': [
          'filled'
        ]
      },
      {
        'd': 'M12,18 M12,17 A1,1,0,0,1,13,18 A1,1,0,0,1,12,19 A1,1,0,0,1,11,18 A1,1,0,0,1,12,17',
        'classes': [
          'filled'
        ]
      },
      {
        'd': 'M12,6 M12,5 A1,1,0,0,1,13,6 A1,1,0,0,1,12,7 A1,1,0,0,1,11,6 A1,1,0,0,1,12,5',
        'classes': [
          'filled'
        ]
      }
    ]
  },
  /*
  'comment': {
    'paths': [
      {
        'd': 'M4,21 L4,8 A3,3,0,0,1,7,5 L17,5 A3,3,0,0,1,20,8 L20,14 A3,3,0,0,1,17,17 L8,17 L4,21'
      },
      {
        'd': 'M8,13 L14,13 M8,9 L16,9'
      }
    ]
  },
  'wrap': {
    'paths': [
      {
        'd': 'M5,6 L19,6'
      },
      {
        'd': 'M5,12 L17,12 A3,3,180,0,1,17,18 L13,18'
      },
      {
        'd': 'M5,18 L10,18'
      },
      {
        'd': 'M12,18 L14.25,20.25 L14.25,20.25 M12,18 L14.25,15.75'
      }
    ]
  },
    */

  'align-middle': {
    'paths': [
      {
        'd': 'M6,12 L18,12 M12,9 L9,6 M12,9 L15,6 M12,9 L12,3 M12,15 L9,18 M12,15 L15,18 M12,15 L12,21'
      }
    ]
  },
  'align-top': {
    'paths': [
      {
        'd': 'M6,4 L18,4 M12,7 L15,10 M12,7 L9,10 M12,7 L12,20'
      }
    ]
  },
  'align-bottom': {
    'paths': [
      {
        'd': 'M18,20 L6,20 M12,17 L9,14 M12,17 L15,14 M12,17 L12,4'
      }
    ]
  },
  'text-color': {
    'paths': [
      {
        'd': 'M12,4 L7,16 M12,4 L17,16 M8.5,12.5 L15.5,12.5'
      },
      {
        'd': 'M3,19 L21,19 L21,23 L3,23 L3,19',
        'classes': [
          'target-fill',
          'filled'
        ]
      }
    ]
  },

  'fill-color': {
    'paths': [
      {
        'd': 'M6,11 L10,15 L14,11 L6,11',
        'classes': [
          'secondary',
          'filled'
        ]
      },
      {
        'd': 'M8,2 L16,10 L10,16 L5,11 L11,5'
      },
      {
        'd': 'M17,13 L16,15 A1,1,0,0,0,17,16 A1,1,0,0,0,18,15 L17,13'
      },
      {
        'd': 'M3,19 L21,19 L21,23 L3,23 L3,19',
        'classes': [
          'target-fill',
          'filled'
        ]
      }
    ]
  },

  'border-all': {
    'paths': [
      {
        'd': 'M4,4 L20,4 L20,20 L4,20 L4,4 M4,12 L20,12 M12,4 L12,20',
        'classes': ['target-stroke', 'line-icon']
      }
    ]
  },
  'border-none': {
    'paths': [
      {
        'd': 'M4,4 L20,4 L20,20 L4,20 L4,4 M4,12 L20,12 M12,4 L12,20',
        'classes': [
          'secondary'
        ]
      }
    ]
  },
  'border-left': {
    'paths': [
      {
        'd': 'M4,4 L20,4 L20,20 L4,20 M12,4 L12,20 M4,12 L20,12',
        'classes': [
          'secondary'
        ]
      },
      {
        'd': 'M4,20 L4,4',
        'classes': ['target-stroke', 'line-icon']
      }
    ]
  },
  'border-right': {
    'paths': [
      {
        'd': 'M20,20 L4,20 L4,4 L20,4 M12,4 L12,20 M4,12 L20,12',
        'classes': [
          'secondary'
        ]
      },
      {
        'd': 'M20,4 L20,20',
        'classes': ['target-stroke', 'line-icon']
      }
    ]
  },
  'border-top': {
    'paths': [
      {
        'd': 'M20,4 L20,20 L4,20 L4,4 M4,12 L20,12 M12,20 L12,4',
        'classes': [
          'secondary'
        ]
      },
      {
        'd': 'M4,4 L20,4',
        'classes': ['target-stroke', 'line-icon']
      }
    ]
  },
  'border-double-bottom': {
    'paths': [
      {
        'd': 'M4,20 L4,4 L20,4 L20,20 M20,12 L4,12 M12,4 L12,20 M4,20 L20,20' ,
        'classes': [
          'secondary'
        ]
      },
      {
        'd': 'M4,22 L20,22 M20,19 L4,19',
        'classes': ['target-stroke', 'line-icon']
      }
    ]
  },
  'border-bottom': {
    'paths': [
      {
        'd': 'M4,20 L4,4 L20,4 L20,20 M20,12 L4,12 M12,4 L12,20 M4,20 L20,20' ,
        'classes': [
          'secondary'
        ]
      },
      {
        'd': 'M20,21 L4,21',
        'classes': ['target-stroke', 'line-icon']
      }
    ]
  },
  'border-outside': {
    'paths': [
      {
        'd': 'M4,12 L20,12M12,4 L12,20',
        'classes': [
          'secondary'
        ]
      },
      {
        'd': 'M4,4 L20,4 L20,20 L4,20 L4,4',
        'classes': ['target-stroke', 'line-icon']
      }
    ]
  },
  'align-left': {
    'paths': [
      {
        'd': 'M5,4 L19,4M5,20 L19,20M5,8 L13,8M5,12 L15,12M5,16 L13,16'
      }
    ]
  },
  'align-center': {
    'paths': [
      {
        'd': 'M7,12 L17,12'
      },
      {
        'd': 'M5,4 L19,4'
      },
      {
        'd': 'M5,20 L19,20'
      },
      {
        'd': 'M8,8 L16,8'
      },
      {
        'd': 'M8,16 L16,16'
      }
    ]
  },
  'align-right': {
    'paths': [
      {
        'd': 'M19,20 L5,20'
      },
      {
        'd': 'M19,4 L5,4'
      },
      {
        'd': 'M19,16 L11,16'
      },
      {
        'd': 'M19,12 L9,12'
      },
      {
        'd': 'M19,8 L11,8'
      }
    ]
  },
  'merge-cells': {
    'paths': [
      {
        'd': 'M5,9 L9,9 L9,5'
      },
      {
        'd': 'M15,5 L15,9 L19,9'
      },
      {
        'd': 'M19,15 L15,15 L15,19'
      },
      {
        'd': 'M5,15 L9,15 L9,19'
      }
    ]
  },
  'unmerge-cells': {
    'paths': [
      {
        'd': 'M14,6 L18,6 L18,10'
      },
      {
        'd': 'M10,6 L6,6 L6,10'
      },
      {
        'd': 'M6,14 L6,18 L10,18'
      },
      {
        'd': 'M14,18 L18,18 L18,14'
      }
    ]
  },
  'crop': {
    'paths': [
      {
        'd': 'M8,7 L4,7'
      },
      {
        'd': 'M8,4 L8,16 L20,16'
      },
      {
        'd': 'M17,16 L17,20'
      },
      {
        'd': 'M11,7 L17,7 L17,13'
      }
    ]
  },
  'snowflake': {
    'paths': [
      {
        'd': 'M8,5 L12,9 L16,5 M8,19 L12,15 L16,19 M15,12 L19,16 M15,12 L19,8 M9,12 L5,8 M9,12 L5,16 M3,12 L21,12 M12,3 L12,21'
      }
    ]
  },
  'number-format': {
    'paths': [
      {
        'd': 'M8,19 L11,5'
      },
      {
        'd': 'M16,5 L13,19'
      },
      {
        'd': 'M7,9 L18,9'
      },
      {
        'd': 'M17,15 L6,15'
      }
    ]
  },

  'column-chart': {
    'paths': [
      {
        'd': 'M6,19 L6,10'
      },
      {
        'd': 'M10,19 L10,13'
      },
      {
        'd': 'M14,19 L14,5'
      },
      {
        'd': 'M18,19 L18,9'
      }
    ]
  },
  'donut-chart': {
    'paths': [
      {
        'd': 'M12,4 A8,8,0,0,1,17.65685,6.34315'
      },
      {
        'd': 'M19.72741,9.92945 A8,8,75,0,1,12,20'
      },
      {
        'd': 'M8,18.9282 A8,8,75,0,1,8,5.0718'
      }
    ]
  },
  'bar-chart': {
    'paths': [
      {
        'd': 'M5,6 L14,6'
      },
      {
        'd': 'M5,10 L11,10'
      },
      {
        'd': 'M5,14 L19,14'
      },
      {
        'd': 'M5,18 L15,18'
      }
    ]
  },
  'line-chart': {
    'paths': [
      {
        'd': 'M5,15 L9,11 L13,15 L19,9'
      }
    ]
  },

};

