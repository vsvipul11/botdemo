// types/tools.ts
export interface ConsultationToolRequest {
    consultationData: {
      symptoms: {
        symptom: string;
        severity: string;
        duration: string;
      }[];
      appointment?: {
        date: string;
        time: string;
        email: string;
      };
      assessmentStatus: string;
    };
  }
  
  export interface ConsultationToolResponse {
    success: boolean;
    message?: string;
  }
  
  export type ToolResponse = ConsultationToolResponse;