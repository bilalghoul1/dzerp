export type {
  DocumentCategory,
  DocumentActionId,
  DocumentListColumnId,
  DocumentUiConfig,
  DocumentRow,
  DocumentLineModel,
  DocumentDetailModel,
  AttachmentItem,
  RelationItem,
  ListResult,
  TransitionsResult,
  EditorPermissions,
} from "./ui-types";

export {
  getUiConfig,
  getAllUiConfigs,
  getUiConfigsByCategory,
  getSalesDocTypes,
  getPurchasingDocTypes,
  isLegacyDocType,
} from "./ui-config";

export { STATUS_ORDER, STATUS_META } from "./status-meta";
export type { StatusMeta } from "./status-meta";

export {
  normalizeDocumentRow,
  normalizeDocumentDetail,
  normalizeLine,
  normalizeAttachment,
  normalizeRelation,
} from "./normalize";

export {
  DocumentApiError,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  getTransitions,
  changeStatus,
  approveDocument,
  getRelations,
  getConversionHistory,
  convertDocument,
  listAttachments,
  deleteAttachment,
  uploadAttachments,
  listDocumentsUrl,
} from "./api";
export type { ListParams, DocumentActivityEvent } from "./api";
