
/**
 * TODO: possibly add an allow-list for remotes
 */
export interface ValidURIOptions {
  
  /** allow data: uri (default true) */
  data: boolean; 

  /** allow same-origin (default true) */
  same_origin: boolean;

  /** allow remote (default false) */
  remote: boolean;

}

const default_uri_options: ValidURIOptions = {
  data: true,
  same_origin: true,
  remote: false,
};

/**
 * check if this resource is a valid URI. by default we only 
 * allow data: and same-origin URIs, but you can override that
 * with a flag.
 * 
 * this assumes we have a document (and location) so it should
 * only be called from browser context.
 */
export const ValidateURI = (resource: string, options: Partial<ValidURIOptions> = {}): string|undefined => {

  const composite: ValidURIOptions = {
    ...default_uri_options,
    ...options,
  };

  // console.info({composite});

  try {
    const url = new URL(resource, document.location.href);
    
    if (url.protocol === 'data:') {
      return composite.data ? url.href : undefined;
    }
    
    if (url.origin === document.location.origin) {
      return composite.same_origin ? url.href : undefined;
    }

    return composite.remote ? url.hash : undefined;

  }
  catch (err) {
    console.error(err);
  }

  return undefined;

};
