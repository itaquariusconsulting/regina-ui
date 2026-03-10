export interface RegSecProfilePermissions {
  profileId: number;
  menuId: number;
  codEmpresa: string;
  
  menuRoute: string;
  menuLabel: string;
  menuIcon: string;
  menuParentId: number | null;
  
  permitView: boolean;
  permitCreate: boolean;
  permitEdit: boolean;
  permitDelete: boolean;
  
  isModified?: boolean; 
}