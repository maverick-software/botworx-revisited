# ✅ **FIXED: Proper Datastore Filtering & Selection**

## 🎯 **What Was Fixed**

Fixed the datastore selection logic to ensure proper type filtering and one-per-side selection as requested:

## 🔧 **Corrected Behavior**

### **1. Vector Datastore Button** 
- ✅ **Shows ONLY Pinecone datastores** (`type: 'pinecone'`)
- ✅ **One selection max** - replaces existing vector datastore  
- ✅ **Proper filtering** - No GetZep datastores appear

### **2. Knowledge Graph Button**
- ✅ **Shows ONLY GetZep datastores** (`type: 'getzep'`)
- ✅ **One selection max** - replaces existing knowledge graph datastore
- ✅ **Proper filtering** - No Pinecone datastores appear

## 🔄 **Selection Logic**

### **Vector Datastore Flow**
```
Click "Vector Datastore" →
├─ Filter: availableDatastores.filter(ds => ds.type === 'pinecone')
├─ 0 Pinecone datastores → Create new Pinecone
├─ 1 Pinecone datastore → Replace existing + connect
└─ 2+ Pinecone datastores → Show modal with ONLY Pinecone options

Modal Selection →
├─ Remove any existing vector datastores (Pinecone type)
└─ Connect selected Pinecone datastore
```

### **Knowledge Graph Flow**  
```
Click "Knowledge Graph" →
├─ Filter: availableDatastores.filter(ds => ds.type === 'getzep')  
├─ 0 GetZep datastores → Create new GetZep
├─ 1 GetZep datastore → Replace existing + connect
└─ 2+ GetZep datastores → Show modal with ONLY GetZep options

Modal Selection →
├─ Remove any existing knowledge graph datastores (GetZep type)
└─ Connect selected GetZep datastore
```

## 🎨 **UI Behavior**

### **Vector Datastore Selection Modal**
```
🔵 Select Vector Datastore
Choose a Pinecone vector database...

📊 [Production Pinecone Index]     ✓ Available
📊 [Development Pinecone Index]    ✓ Available  
📊 [Research Pinecone Index]       ✓ Available

❌ NO GetZep datastores shown
```

### **Knowledge Graph Selection Modal**
```
🟢 Select Knowledge Graph  
Choose a GetZep knowledge graph...

🧠 [Company Knowledge Graph]       ✓ Available
🧠 [Research Knowledge Graph]      ✓ Available
🧠 [Customer Data Graph]           ✓ Available

❌ NO Pinecone datastores shown
```

## 🔧 **Technical Implementation**

### **Filtering Function**
```typescript
const getDatastoresByType = (type: 'pinecone' | 'getzep') => {
  return availableDatastores.filter(ds => ds.type === type);
};
```

### **Replacement Logic**
```typescript
// Vector datastore selection (replaces existing)
const vectorDatastoreIds = getDatastoresByType('pinecone').map(ds => ds.id);
setConnectedDatastores(prev => {
  const withoutOtherVectors = prev.filter(id => !vectorDatastoreIds.includes(id));
  return [...withoutOtherVectors, newDatastoreId];
});

// Knowledge graph selection (replaces existing)  
const knowledgeDatastoreIds = getDatastoresByType('getzep').map(ds => ds.id);
setConnectedDatastores(prev => {
  const withoutOtherKnowledge = prev.filter(id => !knowledgeDatastoreIds.includes(id));
  return [...withoutOtherKnowledge, newDatastoreId];
});
```

## 🧪 **Test Scenarios**

### **Test 1: Vector Datastore Filtering**
1. Create 2 Pinecone + 2 GetZep datastores
2. Click "Vector Datastore" → Should see ONLY 2 Pinecone options
3. Select one → Should connect only that Pinecone datastore

### **Test 2: Knowledge Graph Filtering**  
1. Same setup (2 Pinecone + 2 GetZep)
2. Click "Knowledge Graph" → Should see ONLY 2 GetZep options
3. Select one → Should connect only that GetZep datastore

### **Test 3: One Per Side Replacement**
1. Connect to Pinecone A + GetZep A
2. Click "Vector Datastore" → Select Pinecone B  
3. Should now have: Pinecone B + GetZep A (replaced vector, kept knowledge)
4. Click "Knowledge Graph" → Select GetZep B
5. Should now have: Pinecone B + GetZep B (kept vector, replaced knowledge)

## ✅ **Fixed Issues**

- ❌ **Before**: Mixed datastore types in selection modals
- ✅ **After**: Strict type filtering (Pinecone vs GetZep)

- ❌ **Before**: Could connect multiple of same type  
- ✅ **After**: One vector + one knowledge graph max

- ❌ **Before**: Adding to existing connections
- ✅ **After**: Replacing existing connections of same type

## 🎉 **Result**

**Perfect datastore selection behavior!** Each agent can now have:
- **Exactly 0 or 1 Vector Datastore** (Pinecone)
- **Exactly 0 or 1 Knowledge Graph Datastore** (GetZep)  
- **Clean type separation** with proper filtering
- **Intuitive replacement** when switching datastores