import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Database, Plus } from 'lucide-react';

interface Datastore {
  id: string;
  name: string;
  type: string;
}

interface KnowledgeGraphModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  knowledgeStores: Datastore[];
  selectedKnowledgeStore: string | undefined;
  onSelectDatastore: (value: string) => void;
  onCreateNew: () => void;
  connecting: boolean;
  loadingAvailable: boolean;
}

export const KnowledgeGraphModal: React.FC<KnowledgeGraphModalProps> = ({
  isOpen,
  onOpenChange,
  knowledgeStores,
  selectedKnowledgeStore,
  onSelectDatastore,
  onCreateNew,
  connecting,
  loadingAvailable
}) => {
  const connectedStore = knowledgeStores.find(ds => ds.id === selectedKnowledgeStore);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configure Knowledge Graph</DialogTitle>
          <DialogDescription>
            Select or create a knowledge graph datastore.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Current Connection Display */}
          {connectedStore && (
            <>
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Currently Connected</p>
                      <p className="text-xs text-slate-400">{connectedStore.name}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectDatastore('')}
                    disabled={connecting}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-slate-600/50"></div>
                <span className="text-xs text-slate-500 px-2">or select different</span>
                <div className="flex-1 border-t border-slate-600/50"></div>
              </div>
            </>
          )}
          
          {loadingAvailable ? (
            <p className="text-center text-muted-foreground">Loading knowledge graphs...</p>
          ) : (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Available Knowledge Graphs</Label>
              <Select 
                value={selectedKnowledgeStore || 'none'}
                onValueChange={(value) => onSelectDatastore(value === 'none' ? '' : value)}
                disabled={connecting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a knowledge graph..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {knowledgeStores.map(ds => (
                    <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline"
                onClick={onCreateNew}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Knowledge Graph
              </Button>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} disabled={connecting}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 