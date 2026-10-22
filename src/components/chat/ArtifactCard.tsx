/**
 * ArtifactCard Component
 * Inline artifact preview in chat (ChatGPT-style)
 */

import React from 'react';
import {
  FileText,
  FileCode,
  Copy,
  Edit3,
  Download
} from 'lucide-react';
import { Artifact, ArtifactCardProps } from '@/types/artifacts';
import { toast } from 'react-hot-toast';

// Icon mapping
const getArtifactIcon = (fileType: string) => {
  const iconMap: Record<string, typeof FileText> = {
    txt: FileText,
    md: FileText,
    json: FileCode,
    html: FileCode,
    javascript: FileCode,
    typescript: FileCode,
    python: FileCode,
    java: FileCode,
    css: FileCode,
    csv: FileText,
    sql: FileCode,
    yaml: FileCode,
    xml: FileCode,
    bash: FileCode,
    shell: FileCode,
    dockerfile: FileCode
  };
  
  return iconMap[fileType] || FileText;
};

export const ArtifactCard: React.FC<ArtifactCardProps> = ({
  artifact,
  onOpenCanvas,
  onDownload
}) => {
  const Icon = getArtifactIcon(artifact.file_type);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="my-3 rounded-xl bg-[#2f2f2f] border border-[#444] overflow-hidden">
      {/* Compact artifact card - just title and actions */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-white">
            {artifact.title}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors"
            title="Copy to clipboard"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={() => onOpenCanvas(artifact)}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors"
            title="Edit in Canvas"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDownload(artifact)}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors"
            title="Download file"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
