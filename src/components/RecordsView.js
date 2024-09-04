import { AirComponent, html, onMount, state } from '@air-apps/air-js';
class ApiService {
    constructor(baseUrl) {
      this.baseUrl = baseUrl;
    }
  
    async getNodes(nodePaths, limit = 100, offset = 0) {
      const token = PydioApi._PydioRestClient.authentications.oauth2.accessToken;
      const response = await fetch(`${this.baseUrl}/a/tree/stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          NodePaths: nodePaths,
          Limit: limit,
          Offset: offset,
          AllMetaProviders: true,
        }),
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      return response.json();
    }
  
    static buildHierarchy(nodes, parentPath = '') {
      const hierarchy = [];
      const nodeMap = new Map();
  
      nodes.forEach(node => {
        const relativePath = node.Path.substring(parentPath.length);
        const parts = relativePath.split('/').filter(Boolean);
        
        const record = {
          id: node.Uuid,
          title: parts[parts.length - 1],
          path: node.Path,
          type: node.Type,
          children: [],
          MetaStore: node.MetaStore
        };
  
        nodeMap.set(node.Path, record);
  
        if (parts.length === 1) {
          hierarchy.push(record);
        } else {
          const parentNodePath = node.Path.substring(0, node.Path.lastIndexOf('/'));
          const parentNode = nodeMap.get(parentNodePath);
          if (parentNode) {
            parentNode.children.push(record);
          }
        }
      });
  
      return hierarchy;
    }
  }
  
  const TreeViewAccordion = AirComponent('treeview-accordion', function() {
    const records = state([])
    const apiService = new ApiService('https://www.curate.penwern.co.uk');
  
    onMount( () => {
       loadInitialData();
    });
  
    const loadInitialData = async () => {
      try {
        const response = await apiService.getNodes(['appraisal/*']);
        records.set(ApiService.buildHierarchy(response.Nodes, 'appraisal/'));
        console.log('Initial records:', records());
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
  
    const renderTree = (records, parentElement) => {
      return records.map(record => {
        const hasChildren = record.type === 'COLLECTION' || (record.children && record.children.length > 0);
        
        return html`
          <div class="record" data-id="${record.id}" data-path="${record.path}">
            <span class="toggle-icon">${hasChildren ? '▶' : ''}</span>
            <span class="record-title">${record.title}</span>
            ${hasChildren ? html`
              <div class="children" style="display: none;">
                ${record.children && record.children.length > 0 ? 
                  renderTree(record.children) : 
                  html`<div class="loading">Loading...</div>`}
              </div>
            ` : ''}
          </div>
        `;
      });
    };
  
    const handleClick = async (event) => {
      const recordElement = event.target.closest('.record');
      if (!recordElement) return;
  
      // Handle selection
      const selectedId = recordElement.dataset.id;
      records.set(records().map(record => ({
        ...record,
        selected: record.id === selectedId
      })));
  
      const recordId = recordElement.dataset.id;
      const recordPath = recordElement.dataset.path;
  
      // Find the selected record data
      let selectedRecord = findRecordById(records(), recordId);
  
      if (!selectedRecord) {
        try {
          const response = await apiService.getNodes([recordPath]);
          const fetchedRecords = ApiService.buildHierarchy(response.Nodes, recordPath.substring(0, recordPath.lastIndexOf('/') + 1));
          selectedRecord = fetchedRecords[0];
        } catch (error) {
          console.error('Error fetching record data:', error);
        }
      }
  
      if (selectedRecord) {
        this.dispatchEvent(new CustomEvent('recordSelected', { 
          bubbles: true, 
          composed: true,
          detail: selectedRecord
        }));
      } else {
        console.error('Selected record not found:', recordId);
      }
  
      // Handle expansion if clicked on toggle icon
      if (event.target.classList.contains('toggle-icon')) {
        const toggleIcon = event.target;
        const childrenContainer = recordElement.querySelector('.children');
        if (childrenContainer) {
          const isExpanded = childrenContainer.style.display === 'block';
          if (!isExpanded && childrenContainer.children.length === 1 && childrenContainer.children[0].classList.contains('loading')) {
            // Load children
            await loadChildren(recordPath, childrenContainer);
          }
          childrenContainer.style.display = isExpanded ? 'none' : 'block';
          toggleIcon.textContent = isExpanded ? '▶' : '▼';
        }
      }
    };
  
    const loadChildren = async (parentPath, childrenContainer) => {
      try {
        const response = await apiService.getNodes([`${parentPath}/*`]);
        if (response.Nodes && response.Nodes.length > 0) {
          const children = ApiService.buildHierarchy(response.Nodes, parentPath);
          console.log('Loaded children:', children);
          records.set(updateRecordsWithChildren(records(), parentPath, children));
        }
      } catch (error) {
        console.error('Error loading children:', error);
        childrenContainer.innerHTML = '<div class="loading">Error loading children</div>';
      }
    };
  
    const updateRecordsWithChildren = (records, parentPath, newChildren) => {
      return records.map(record => {
        if (record.path === parentPath) {
          return { ...record, children: newChildren };
        } else if (record.children) {
          return { ...record, children: updateRecordsWithChildren(record.children, parentPath, newChildren) };
        }
        return record;
      });
    };
  
    const findRecordById = (records, id) => {
      for (const record of records) {
        if (record.id === id) {
          return record;
        }
        if (record.children) {
          const found = findRecordById(record.children, id);
          if (found) return found;
        }
      }
      return null;
    };
  
    return () => html`
      <style>
        .record {
          cursor: pointer;
          padding: 5px;
          user-select: none;
        }
        .record-title {
          display: inline-block;
          margin-left: 5px;
        }
        .toggle-icon {
          display: inline-block;
          width: 10px;
          text-align: center;
        }
        .children {
          padding-left: 20px;
          display: none;
        }
        .selected {
          background-color: #e0e0e0;
        }
        .loading {
          color: #888;
          font-style: italic;
        }
      </style>
      <div id="tree-root" onclick="${handleClick}">
        ${renderTree(records())}
      </div>
    `;
  });
  
  const MetadataView = AirComponent('metadata-view', function() {

    const metadata = state({});
    const formatSectionTitle = (section) => {
      return section.split(/(?=[A-Z])/).join(' ');
    };
  
    const formatFieldName = (field) => {
      return field.split(/(?=[A-Z])/).join(' ');
    };
  
    const extractIsadgMetadata = (record) => {
      console.log(record);
      const metaStore = record.MetaStore || {};
      return {
        identity: {
          referenceCode: metaStore['usermeta-isadg-reference-codes'] || '',
          title: metaStore['usermeta-isadg-title'] || '',
          dates: metaStore['usermeta-isadg-dates'] || '',
          levelOfDescription: metaStore['usermeta-isadg-level-of-description'] || '',
          extentAndMedium: metaStore['usermeta-isadg-extent-and-medium-of-the-unit-of-description'] || ''
        },
        context: {
          nameOfCreator: metaStore['usermeta-isadg-name-of-creator'] || '',
          administrativeHistory: metaStore['usermeta-isadg-administrative-history'] || '',
          archivalHistory: metaStore['usermeta-isadg-archival-history'] || '',
          immediateSourceOfAcquisition: metaStore['usermeta-isadg-immediate-source-of-acquisition'] || ''
        },
        contentAndStructure: {
          scopeAndContent: metaStore['usermeta-isadg-scope-and-content'] || '',
          appraisalDestruction: metaStore['usermeta-isadg-appraisal-destruction'] || '',
          accruals: metaStore['usermeta-isadg-accruals'] || '',
          systemOfArrangement: metaStore['usermeta-isadg-system-of-arrangement'] || ''
        },
        conditionsOfAccessAndUse: {
          conditionsGoverningAccess: metaStore['usermeta-isadg-conditions-governing-access'] || '',
          conditionsGoverningReproduction: metaStore['usermeta-isadg-conditions-governing-reproduction'] || '',
          languageScripts: metaStore['usermeta-isadg-languagescripts-of-material'] || '',
          physicalCharacteristics: metaStore['usermeta-isadg-physical-characteristics-and-technical-requirements'] || '',
          findingAids: metaStore['usermeta-isadg-finding-aids'] || ''
        },
        alliedMaterials: {
          existenceLocationOfOriginals: metaStore['usermeta-isadg-existence-and-location-of-originals'] || '',
          existenceLocationOfCopies: metaStore['usermeta-isadg-existence-and-location-of-copies'] || '',
          relatedUnitsOfDescription: metaStore['usermeta-isadg-related-units-of-description'] || '',
          publicationNote: metaStore['usermeta-isadg-publication-note'] || ''
        },
        notes: {
          note: metaStore['usermeta-isadg-note'] || ''
        },
        descriptionControl: {
          archivistNote: metaStore['usermeta-isadg-archivist-note'] || '',
          rulesOrConventions: metaStore['usermeta-isadg-rules-or-conventions'] || '',
          dateOfDescriptions: metaStore['usermeta-isadg-dates-of-descriptions'] || ''
        }
      };
    };
  
    const updateMetadata = (record) => {
      metadata.set(extractIsadgMetadata(record));
    };
  
    return () => html`
      <style>
        :host {
          font-family: Arial, sans-serif;
        }
        h2 {
          border-bottom: 1px solid #ccc;
          padding-bottom: 10px;
        }
        .metadata-section {
          margin-bottom: 20px;
        }
        .metadata-field {
          margin-bottom: 10px;
        }
        .field-name {
          font-weight: bold;
        }
        .field-value {
          margin-left: 10px;
        }
      </style>
      <h2>ISAD(G) Metadata</h2>
      <div id="metadataContent">
        ${Object.entries(metadata()).map(([section, fields]) => html`
          <div class="metadata-section">
            <h3>${formatSectionTitle(section)}</h3>
            ${Object.entries(fields).map(([field, value]) => value ? html`
              <div class="metadata-field">
                <span class="field-name">${formatFieldName(field)}:</span>
                <span class="field-value">${value}</span>
              </div>
            ` : '')}
          </div>
        `)}
      </div>
    `;
  });
  
  const FilesView = AirComponent('files-view', function() {
    return () => html`
      <h2>Associated Files</h2>
      <div id="filesContent">Files information not available in this version</div>
    `;
  });
  
  export const ArchivalRecordsViewer = AirComponent('archival-records-viewer', function() {
    const selectedRecord = state(null);
    const handleRecordSelected = (e) => {
      selectedRecord.set(e.detail);
    };
  
    return () => html`
      <style>
        :host {
          display: flex;
          font-family: Arial, sans-serif;
        }
        #treeview {
          width: 30%;
          border-right: 1px solid #ccc;
          padding: 10px;
          overflow-y: auto;
        }
        #metadata, #files {
          width: 35%;
          padding: 10px;
          overflow-y: auto;
        }
      </style>
      <div id="treeview">
        <treeview-accordion props=${{ onrecordSelected: handleRecordSelected }}></treeview-accordion>
      </div>
      <div id="metadata">
        <metadata-view props=${{ record: selectedRecord }}></metadata-view>
      </div>
      <div id="files">
        <files-view props=${{ record: selectedRecord }}></files-view>
      </div>
    `;
  });