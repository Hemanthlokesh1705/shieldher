import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  UploadResponse,
  VerificationResponse,
  ForensicsResponse,
  ReverseSearchResponse,
  ComplaintDraftResponse,
  CaseItem,
} from "../types/models";

export interface VerificationConsent {
  allowLocalAnalysis: boolean;
  allowReverseSearch: boolean;
  retentionPolicy: "TEMPORARY_EXPLORATORY" | "PRESERVED";
}

interface VerificationContextType {
  consent: VerificationConsent;
  setConsent: React.Dispatch<React.SetStateAction<VerificationConsent>>;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  filePreviewUrl: string | null;
  uploadData: UploadResponse | null;
  setUploadData: (data: UploadResponse | null) => void;
  activeCase: CaseItem | null;
  setActiveCase: (c: CaseItem | null) => void;
  verificationData: VerificationResponse | null;
  setVerificationData: (data: VerificationResponse | null) => void;
  forensicsData: ForensicsResponse | null;
  setForensicsData: (data: ForensicsResponse | null) => void;
  reverseSearchResult: ReverseSearchResponse | null;
  setReverseSearchResult: (data: ReverseSearchResponse | null) => void;
  incidentAnswers: Record<string, any>;
  setIncidentAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  complaintDraft: ComplaintDraftResponse | null;
  setComplaintDraft: (data: ComplaintDraftResponse | null) => void;
  resetWorkflow: () => void;
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

export const VerificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [consent, setConsent] = useState<VerificationConsent>({
    allowLocalAnalysis: true,
    allowReverseSearch: false,
    retentionPolicy: "TEMPORARY_EXPLORATORY",
  });

  const [selectedFile, setSelectedFileState] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [activeCase, setActiveCase] = useState<CaseItem | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationResponse | null>(null);
  const [forensicsData, setForensicsData] = useState<ForensicsResponse | null>(null);
  const [reverseSearchResult, setReverseSearchResult] = useState<ReverseSearchResponse | null>(null);
  const [incidentAnswers, setIncidentAnswers] = useState<Record<string, any>>({});
  const [complaintDraft, setComplaintDraft] = useState<ComplaintDraftResponse | null>(null);

  const setSelectedFile = (file: File | null) => {
    setSelectedFileState(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const resetWorkflow = () => {
    setSelectedFile(null);
    setUploadData(null);
    setActiveCase(null);
    setVerificationData(null);
    setForensicsData(null);
    setReverseSearchResult(null);
    setIncidentAnswers({});
    setComplaintDraft(null);
    setConsent({
      allowLocalAnalysis: true,
      allowReverseSearch: false,
      retentionPolicy: "TEMPORARY_EXPLORATORY",
    });
  };

  return (
    <VerificationContext.Provider
      value={{
        consent,
        setConsent,
        selectedFile,
        setSelectedFile,
        filePreviewUrl,
        uploadData,
        setUploadData,
        activeCase,
        setActiveCase,
        verificationData,
        setVerificationData,
        forensicsData,
        setForensicsData,
        reverseSearchResult,
        setReverseSearchResult,
        incidentAnswers,
        setIncidentAnswers,
        complaintDraft,
        setComplaintDraft,
        resetWorkflow,
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
};

export function useVerification() {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error("useVerification must be used within a VerificationProvider");
  }
  return context;
}
