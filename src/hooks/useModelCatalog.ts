import {
  getModelCatalogVersion,
  subscribeToModelCatalog,
  warmModelCatalog,
} from '../lib/model-catalog.js';

import { useEffect, useState } from 'react';

export function useModelCatalogVersion(): number {
  const [version, setVersion] = useState(() => getModelCatalogVersion());

  useEffect(() => {
    warmModelCatalog();
    return subscribeToModelCatalog(() => {
      setVersion(getModelCatalogVersion());
    });
  }, []);

  return version;
}
