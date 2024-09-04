import { AirComponent, html, onMount, createState, createQuery, airCss } from '@air-apps/air-js';

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

const TreeNode = AirComponent('tree-node', function(props) {
  const [isExpanded, setIsExpanded] = createState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded());
  };

  const nodeStyles = airCss({
    display: 'flex',
    flexDirection: 'column',
    marginLeft: '20px',
    cursor: 'pointer',
    _hover: {
      backgroundColor: '#f0f0f0'
    }
  });

  const titleStyles = airCss({
    display: 'flex',
    alignItems: 'center',
    padding: '5px'
  });

  return () => html`
    <div style=${nodeStyles()}>
      <div style=${titleStyles()} onclick=${toggleExpand}>
        ${props.node.children.length > 0 ? (isExpanded() ? '▼' : '▶') : '•'}
        ${props.node.title}
      </div>
      ${isExpanded() && props.node.children.length > 0 ? html`
        <div>
          ${props.node.children.map(child => html`
            <tree-node props=${{ node: child }}></tree-node>
          `)}
        </div>
      ` : ''}
    </div>
  `;
});

export const TreeViewAccordion = AirComponent('treeview-accordion', function() {
  const apiService = new ApiService('https://www.curate.penwern.co.uk');
  
  const { data: records, isLoading, error, refetch } = createQuery(
    'initialRecords',
    async () => {
      const response = await apiService.getNodes(['appraisal/*']);
      return ApiService.buildHierarchy(response.Nodes, 'appraisal/');
    },
    {
      cacheTime: 5 * 60 * 1000, // 5 minutes
      staleTime: 60 * 1000, // 1 minute
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  );

  const containerStyles = airCss({
    fontFamily: 'Arial, sans-serif',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px'
  });

  return () => html`
    <div style=${containerStyles()}>
      <h2>TreeView Accordion</h2>
      ${isLoading() ? html`
        <p>Loading...</p>
      ` : error() ? html`
        <p>Error: ${error().message}</p>
        <button onclick=${refetch}>Retry</button>
      ` : html`
        ${records().map(record => html`
          <tree-node props=${{ node: record }}></tree-node>
        `)}
      `}
    </div>
  `;
});