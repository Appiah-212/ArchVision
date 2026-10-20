const PROJECT_PREFIX = 'archvision_project_';
const PUBLIC_PROJECT_PREFIX = 'archvision_public_project_';
const PRIVATE_ASSET_PREFIX = 'archvision_private_asset:';
const PRIVATE_ASSET_ROOT = 'archvision_private_assets';
const MAX_PRIVATE_ASSET_SIZE = 50 * 1024 * 1024;
const MAX_DAILY_GENERATIONS = 20;
const GENERATION_LOCK_PREFIX = 'archvision_generation_lock:';
const GENERATION_LOCK_TTL_SECONDS = 30 * 60;
const GENERATION_STALE_AFTER_MS = GENERATION_LOCK_TTL_SECONDS * 1000;
const GENERATION_MODEL_IDENTIFIER = 'gemini-3.1-flash-image-preview';
const BASELINE_PROMPT_TEMPLATE_VERSION = 'archvision-baseline-v1';
const ENHANCED_PROMPT_TEMPLATE_VERSION = 'archvision-enhanced-v1';
const RENDER_CONFIGURATION_OPTIONS = {
    architecturalStyle: ['Modern', 'Contemporary', 'Minimalist', 'Scandinavian', 'Industrial', 'Mediterranean', 'Traditional', 'Custom'],
    flooringMaterial: ['Hardwood', 'Ceramic tile', 'Marble', 'Concrete', 'Vinyl', 'Custom'],
    wallFinish: ['Painted plaster', 'Exposed brick', 'Concrete', 'Wood paneling', 'Stone', 'Custom'],
    colorPalette: ['Neutral', 'Warm earth tones', 'Cool tones', 'Monochrome', 'Natural', 'Custom'],
    lighting: ['Natural daylight', 'Warm ambient', 'Bright studio', 'Evening atmosphere', 'Custom'],
    furnitureStyle: ['Modern', 'Minimalist', 'Scandinavian', 'Traditional', 'Contemporary', 'Custom'],
    perspective: ['Top-down 3D-style view', 'Isometric view', 'Angled architectural view'],
};
const RENDER_CONFIGURATION_CUSTOM_FIELDS = [
    'architecturalStyle',
    'flooringMaterial',
    'wallFinish',
    'colorPalette',
    'lighting',
    'furnitureStyle',
];
const isValidRenderConfiguration = (configuration) => {
    const expectedFields = [
        'schemaVersion',
        'architecturalStyle',
        'flooringMaterial',
        'wallFinish',
        'colorPalette',
        'lighting',
        'furnitureStyle',
        'perspective',
        'customInstructions',
        'customValues',
        'updatedAt',
    ];
    if (!configuration || configuration.schemaVersion !== 1 ||
        Object.keys(configuration).length !== expectedFields.length ||
        Object.keys(configuration).some((field) => !expectedFields.includes(field)) ||
        typeof configuration.updatedAt !== 'string' ||
        !Number.isFinite(Date.parse(configuration.updatedAt)) ||
        typeof configuration.customInstructions !== 'string' ||
        configuration.customInstructions.length > 500 ||
        typeof configuration.customValues !== 'object' ||
        configuration.customValues === null ||
        Array.isArray(configuration.customValues)) {
        return false;
    }
    for (const [field, options] of Object.entries(RENDER_CONFIGURATION_OPTIONS)) {
        if (!options.includes(configuration[field])) return false;
    }
    for (const [field, value] of Object.entries(configuration.customValues)) {
        if (!RENDER_CONFIGURATION_CUSTOM_FIELDS.includes(field) ||
            typeof value !== 'string' || !value.trim() || value.length > 100) {
            return false;
        }
    }
    return RENDER_CONFIGURATION_CUSTOM_FIELDS.every((field) =>
        configuration[field] !== 'Custom' ||
        (typeof configuration.customValues[field] === 'string' &&
            configuration.customValues[field].trim().length > 0)
    );
};
const isValidGenerationMode = (mode) => mode === 'baseline' || mode === 'enhanced';
const isActiveGeneration = (metadata) => metadata?.generationStatus === 'generating' &&
    typeof metadata.generationTimestamp === 'string' &&
    Number.isFinite(Date.parse(metadata.generationTimestamp)) &&
    Date.now() >= Date.parse(metadata.generationTimestamp) &&
    Date.now() - Date.parse(metadata.generationTimestamp) < GENERATION_STALE_AFTER_MS;
const isValidGenerationMetadata = (metadata) => {
    const requiredFields = [
        'generationMode',
        'modelIdentifier',
        'promptTemplateVersion',
        'configurationSnapshot',
        'approvedAnalysisRevision',
        'generationTimestamp',
        'generationStatus',
    ];
    const allowedFields = [
        ...requiredFields,
        'generationLatencyMs',
        'versionId',
        'versionNumber',
    ];
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) ||
        requiredFields.some((field) => !(field in metadata)) ||
        Object.keys(metadata).some((field) => !allowedFields.includes(field)) ||
        !isValidGenerationMode(metadata.generationMode) ||
        metadata.modelIdentifier !== GENERATION_MODEL_IDENTIFIER ||
        ![BASELINE_PROMPT_TEMPLATE_VERSION, ENHANCED_PROMPT_TEMPLATE_VERSION]
            .includes(metadata.promptTemplateVersion) ||
        !Number.isFinite(Date.parse(metadata.generationTimestamp)) ||
        !['generating', 'complete', 'failed'].includes(metadata.generationStatus) ||
        (metadata.generationLatencyMs !== undefined &&
            (!Number.isSafeInteger(metadata.generationLatencyMs) ||
                metadata.generationLatencyMs < 0 || metadata.generationLatencyMs > 1800000)) ||
        (metadata.versionId !== undefined &&
                (typeof metadata.versionId !== 'string' ||
                    !/^[a-f0-9-]{36}$/i.test(metadata.versionId))) ||
        (metadata.versionNumber !== undefined &&
                (!Number.isSafeInteger(metadata.versionNumber) || metadata.versionNumber < 1)) ||
        ((metadata.versionId === undefined) !== (metadata.versionNumber === undefined))) {
        return false;
    }
    if (metadata.configurationSnapshot !== null &&
        !isValidRenderConfiguration(metadata.configurationSnapshot)) return false;
    if (metadata.approvedAnalysisRevision !== null &&
        (!Number.isSafeInteger(metadata.approvedAnalysisRevision) ||
            metadata.approvedAnalysisRevision < 1)) return false;
    if (metadata.generationMode === 'enhanced') {
        return metadata.promptTemplateVersion === 'archvision-enhanced-v1' &&
            isValidRenderConfiguration(metadata.configurationSnapshot) &&
            Number.isSafeInteger(metadata.approvedAnalysisRevision) &&
            metadata.approvedAnalysisRevision > 0;
    }
    return metadata.promptTemplateVersion === 'archvision-baseline-v1' &&
        metadata.configurationSnapshot === null &&
        metadata.approvedAnalysisRevision === null;
};
const withoutPrivateDesignData = (project) => {
    const {
        floorPlanAnalysis: _floorPlanAnalysis,
        renderConfiguration: _renderConfiguration,
        generationMetadata: _generationMetadata,
        approvedAnalysisRevision: _approvedAnalysisRevision,
        renderVersions: _renderVersions,
        activeRenderVersionId: _activeRenderVersionId,
        activeGenerationContext: _activeGenerationContext,
        renderVersionImages: _renderVersionImages,
        fidelityEvaluations: _fidelityEvaluations,
        ...publicProject
    } = project;
    return publicProject;
};

const FIDELITY_RUBRIC_VERSION = 'archvision-structural-fidelity-v1';
const FIDELITY_RUBRIC = [
    ['room_count', 'Room count consistency'],
    ['room_function', 'Room function consistency'],
    ['spatial_relationship', 'Spatial relationship consistency'],
    ['major_walls', 'Major wall arrangement'],
    ['doors_windows', 'Door and window preservation'],
    ['missing_invented', 'Missing or invented features'],
];
const isValidFidelityEvaluation = (evaluation, project, versions, enforceAssociation = true) => {
    const associatedVersion = versions?.find((version) => version.id === evaluation?.renderVersionId);
    const provenance = evaluation?.generationProvenance;
    const allowedEvaluationFields = new Set(['id', 'projectId', 'renderVersionId', 'sourceImageReference', 'generationProvenance', 'approvedAnalysisRevision', 'approvedAnalysisSnapshot', 'rubricVersion', 'evaluationMethod', 'reviewerIdentifier', 'createdAt', 'updatedAt', 'criteria', 'overallScore', 'applicableCriteria', 'unassessableCriteria', 'observations', 'discrepancies', 'limitations', 'status', 'revisionOf']);
    if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation) ||
        Object.keys(evaluation).some((field) => !allowedEvaluationFields.has(field)) ||
        evaluation.projectId !== project.id || !/^[A-Za-z0-9_-]{1,160}$/.test(evaluation.id || '') ||
        typeof evaluation.renderVersionId !== 'string' || evaluation.renderVersionId.length > 160 ||
        (enforceAssociation && !associatedVersion) ||
        (enforceAssociation && evaluation.sourceImageReference !== project.sourceImage) ||
        typeof evaluation.sourceImageReference !== 'string' || evaluation.sourceImageReference.length > 4096 ||
        !provenance || !Number.isSafeInteger(provenance.versionNumber) || provenance.versionNumber < 1 ||
        !isValidGenerationMode(provenance.generationMode) || typeof provenance.modelIdentifier !== 'string' || !provenance.modelIdentifier.trim() || provenance.modelIdentifier.length > 120 ||
        typeof provenance.promptTemplateVersion !== 'string' || !provenance.promptTemplateVersion.trim() || provenance.promptTemplateVersion.length > 120 ||
        !Number.isFinite(Date.parse(provenance.renderCreatedAt)) ||
        (provenance.configurationSnapshot !== null && !isValidRenderConfiguration(provenance.configurationSnapshot)) ||
        (evaluation.approvedAnalysisSnapshot !== undefined && !isValidFloorPlanAnalysis(evaluation.approvedAnalysisSnapshot)) ||
        (evaluation.revisionOf !== undefined && (typeof evaluation.revisionOf !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(evaluation.revisionOf))) ||
        (enforceAssociation && associatedVersion && (associatedVersion.versionNumber !== provenance.versionNumber || associatedVersion.generationMode !== provenance.generationMode || associatedVersion.modelIdentifier !== provenance.modelIdentifier || associatedVersion.promptTemplateVersion !== provenance.promptTemplateVersion || JSON.stringify(associatedVersion.configurationSnapshot) !== JSON.stringify(provenance.configurationSnapshot) || associatedVersion.approvedAnalysisRevision !== evaluation.approvedAnalysisRevision || JSON.stringify(associatedVersion.approvedAnalysisSnapshot) !== JSON.stringify(evaluation.approvedAnalysisSnapshot))) ||
        (evaluation.approvedAnalysisRevision !== null &&
            (!Number.isSafeInteger(evaluation.approvedAnalysisRevision) || evaluation.approvedAnalysisRevision < 1)) ||
        evaluation.rubricVersion !== FIDELITY_RUBRIC_VERSION || evaluation.evaluationMethod !== 'HUMAN_REVIEW' ||
        typeof evaluation.reviewerIdentifier !== 'string' || !evaluation.reviewerIdentifier.trim() || evaluation.reviewerIdentifier.length > 200 ||
        !Number.isFinite(Date.parse(evaluation.createdAt)) || !Number.isFinite(Date.parse(evaluation.updatedAt)) ||
        !Array.isArray(evaluation.criteria) || evaluation.criteria.length !== FIDELITY_RUBRIC.length ||
        !Array.isArray(evaluation.observations) || evaluation.observations.length > 100 ||
        !evaluation.observations.every((item) => typeof item === 'string' && item.length <= 1000) ||
        !Array.isArray(evaluation.discrepancies) || evaluation.discrepancies.length > 100 ||
        !evaluation.discrepancies.every((item) => typeof item === 'string' && item.length <= 1000) ||
        !Array.isArray(evaluation.limitations) || evaluation.limitations.length > 100 ||
        !evaluation.limitations.every((item) => typeof item === 'string' && item.length <= 1000)) return false;
    let points = 0;
    let applicable = 0;
    let unassessable = 0;
    const seen = new Set();
    for (const criterion of evaluation.criteria) {
        const definition = FIDELITY_RUBRIC.find(([id]) => id === criterion?.criterionId);
        const allowedCriterionFields = new Set(['criterionId', 'label', 'rating', 'reviewerNotes', 'supportingEvidence', 'confidenceOrVisibilityNotes']);
        if (!definition || seen.has(definition[0]) || criterion.label !== definition[1] ||
            Object.keys(criterion).some((field) => !allowedCriterionFields.has(field)) ||
            !['PRESERVED', 'PARTIALLY_PRESERVED', 'NOT_PRESERVED', 'CANNOT_DETERMINE'].includes(criterion.rating) ||
            typeof criterion.reviewerNotes !== 'string' || criterion.reviewerNotes.length > 2000 ||
            typeof criterion.confidenceOrVisibilityNotes !== 'string' || criterion.confidenceOrVisibilityNotes.length > 1000 ||
            !Array.isArray(criterion.supportingEvidence) || criterion.supportingEvidence.length > 20 ||
            !criterion.supportingEvidence.every((item) => typeof item === 'string' && item.length <= 1000)) return false;
        seen.add(definition[0]);
        if (criterion.rating === 'CANNOT_DETERMINE') unassessable++;
        else { applicable++; points += criterion.rating === 'PRESERVED' ? 2 : criterion.rating === 'PARTIALLY_PRESERVED' ? 1 : 0; }
    }
    const score = applicable ? Math.round(points / (applicable * 2) * 10000) / 100 : null;
    return evaluation.applicableCriteria === applicable && evaluation.unassessableCriteria === unassessable &&
        evaluation.overallScore === score && evaluation.status === (applicable ? 'COMPLETE' : 'INSUFFICIENT_EVIDENCE');
};

const isValidRenderVersion = (version, projectId) => {
    const requiredFields = [
        'id',
        'projectId',
        'versionNumber',
        'imageAssetReference',
        'generationMode',
        'modelIdentifier',
        'promptTemplateVersion',
        'configurationSnapshot',
        'approvedAnalysisRevision',
        'createdAt',
        'generationStatus',
    ];
    const allowedFields = new Set([
        ...requiredFields,
        'approvedAnalysisSnapshot',
        'generationLatencyMs',
        'name',
        'notes',
    ]);
    if (!version || typeof version !== 'object' || Array.isArray(version) ||
        requiredFields.some((field) => !(field in version)) ||
        Object.keys(version).some((field) => !allowedFields.has(field)) ||
        !/^(?:[a-f0-9-]{36}|legacy_[a-f0-9]{1,16})$/i.test(version.id) ||
        version.projectId !== projectId ||
        !Number.isSafeInteger(version.versionNumber) || version.versionNumber < 1 ||
        !getPrivateAssetFileName(version.imageAssetReference) ||
        !isValidGenerationMode(version.generationMode) ||
        (version.modelIdentifier !== GENERATION_MODEL_IDENTIFIER &&
            !version.id.startsWith('legacy_')) ||
        (version.promptTemplateVersion !==
            (version.generationMode === 'baseline'
                ? BASELINE_PROMPT_TEMPLATE_VERSION
                : ENHANCED_PROMPT_TEMPLATE_VERSION) &&
            !version.id.startsWith('legacy_')) ||
        !Number.isFinite(Date.parse(version.createdAt)) ||
        version.generationStatus !== 'complete' ||
        (version.approvedAnalysisRevision !== null &&
            (!Number.isSafeInteger(version.approvedAnalysisRevision) ||
                version.approvedAnalysisRevision < 1)) ||
        (version.generationLatencyMs !== undefined &&
            (!Number.isSafeInteger(version.generationLatencyMs) ||
                version.generationLatencyMs < 0 || version.generationLatencyMs > 1800000)) ||
        (version.name !== undefined &&
            (typeof version.name !== 'string' || version.name.length > 80)) ||
        (version.notes !== undefined &&
            (typeof version.notes !== 'string' || version.notes.length > 2000)) ||
        (version.approvedAnalysisSnapshot !== undefined &&
            !isValidFloorPlanAnalysis(version.approvedAnalysisSnapshot))) {
        return false;
    }
    if (version.configurationSnapshot !== null &&
        !isValidRenderConfiguration(version.configurationSnapshot)) return false;
    if (version.generationMode === 'enhanced' &&
        !version.id.startsWith('legacy_') &&
        (!version.configurationSnapshot ||
            !Number.isSafeInteger(version.approvedAnalysisRevision) ||
            version.approvedAnalysisRevision < 1 ||
            !version.approvedAnalysisSnapshot)) return false;
    return true;
};

const getRenderVersionMaxNumber = (project) => {
    if (project.renderVersions === undefined ||
        (Array.isArray(project.renderVersions) && project.renderVersions.length === 0)) {
        return project.renderedImage ? 1 : 0;
    }
    if (!Array.isArray(project.renderVersions) ||
        !project.renderVersions.every((version) => isValidRenderVersion(version, project.id)) ||
        new Set(project.renderVersions.map(({ id }) => id)).size !== project.renderVersions.length ||
        new Set(project.renderVersions.map(({ versionNumber }) => versionNumber)).size !==
            project.renderVersions.length) {
        return null;
    }
    return project.renderVersions.reduce(
        (maximum, version) => Math.max(maximum, version.versionNumber),
        0,
    );
};

const getLegacyVersionId = (projectId) => {
    let hash = 2166136261;
    for (let index = 0; index < projectId.length; index += 1) {
        hash = Math.imul(hash ^ projectId.charCodeAt(index), 16777619);
    }
    return `legacy_${(hash >>> 0).toString(16)}`;
};

const toLegacyRenderVersion = (project) => {
    if (!project.renderedImage) return null;
    const metadata = project.generationMetadata;
    const candidateRevision = metadata?.approvedAnalysisRevision ??
        project.approvedAnalysisRevision ?? null;
    const revision = Number.isSafeInteger(candidateRevision) && candidateRevision > 0
        ? candidateRevision
        : null;
    const configurationCandidate = metadata?.configurationSnapshot ??
        project.renderConfiguration;
    const config = isValidRenderConfiguration(configurationCandidate)
        ? configurationCandidate
        : null;
    const generationMode = isValidGenerationMode(metadata?.generationMode)
        ? metadata.generationMode
        : 'baseline';
    const generationTimestamp = typeof metadata?.generationTimestamp === 'string' &&
        Number.isFinite(Date.parse(metadata.generationTimestamp))
        ? metadata.generationTimestamp
        : null;
    const timestamp = typeof project.timestamp === 'number' && Number.isFinite(project.timestamp)
        ? new Date(project.timestamp).toISOString()
        : new Date(0).toISOString();
    return {
        id: getLegacyVersionId(project.id),
        projectId: project.id,
        versionNumber: 1,
        imageAssetReference: project.renderedPath || project.renderedImage,
        generationMode,
        modelIdentifier: typeof metadata?.modelIdentifier === 'string' &&
            metadata.modelIdentifier.trim().length > 0 &&
            metadata.modelIdentifier.length <= 120
            ? metadata.modelIdentifier
            : 'legacy/unknown',
        promptTemplateVersion: typeof metadata?.promptTemplateVersion === 'string' &&
            metadata.promptTemplateVersion.trim().length > 0 &&
            metadata.promptTemplateVersion.length <= 120
            ? metadata.promptTemplateVersion
            : 'legacy/unknown',
        configurationSnapshot: config,
        approvedAnalysisRevision: revision,
        ...(revision && isValidFloorPlanAnalysis(project.floorPlanAnalysis)
            ? { approvedAnalysisSnapshot: project.floorPlanAnalysis }
            : {}),
        createdAt: generationTimestamp ?? timestamp,
        ...(Number.isSafeInteger(metadata?.generationLatencyMs) &&
            metadata.generationLatencyMs >= 0 &&
            metadata.generationLatencyMs <= 1800000
            ? { generationLatencyMs: metadata.generationLatencyMs }
            : {}),
        generationStatus: 'complete',
        name: 'Original render',
    };
};
const isAnalysisText = (value, maxLength = 1000) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
const isAnalysisConfidence = (value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const isAnalysisFindingList = (value) =>
    Array.isArray(value) && value.length <= 200 &&
    new Set(value.map((finding) => finding?.id)).size === value.length &&
    value.every((finding) =>
        finding && isAnalysisText(finding.id, 80) &&
        isAnalysisText(finding.description) &&
        isAnalysisText(finding.location, 300) &&
        isAnalysisConfidence(finding.confidence) &&
        isAnalysisText(finding.evidence)
    );
const isValidFloorPlanAnalysis = (analysis) => {
    if (!analysis || analysis.schemaVersion !== 1 ||
        !isAnalysisText(analysis.model, 120) ||
        !isAnalysisText(analysis.analyzedAt, 80) ||
        !isAnalysisText(analysis.summary, 2000) ||
        !Array.isArray(analysis.rooms) || analysis.rooms.length > 100 ||
        !isAnalysisFindingList(analysis.doors) ||
        !isAnalysisFindingList(analysis.windows) ||
        !isAnalysisFindingList(analysis.walls) ||
        !Array.isArray(analysis.relationships) || analysis.relationships.length > 300 ||
        !Array.isArray(analysis.uncertainties) || analysis.uncertainties.length > 100 ||
        !analysis.uncertainties.every((item) => isAnalysisText(item, 500))) {
        return false;
    }
    const roomIds = new Set();
    for (const room of analysis.rooms) {
        if (!room || !isAnalysisText(room.id, 80) ||
            !isAnalysisText(room.label, 120) ||
            (room.possibleFunction !== null && !isAnalysisText(room.possibleFunction, 120)) ||
            !isAnalysisConfidence(room.confidence) ||
            !isAnalysisText(room.evidence) ||
            roomIds.has(room.id)) {
            return false;
        }
        roomIds.add(room.id);
    }
    return new Set(analysis.relationships.map((relationship) => relationship?.id)).size ===
        analysis.relationships.length &&
        analysis.relationships.every((relationship) =>
            relationship && isAnalysisText(relationship.id, 80) &&
            roomIds.has(relationship.fromRoomId) &&
            roomIds.has(relationship.toRoomId) &&
            isAnalysisText(relationship.relationship, 300) &&
            isAnalysisConfidence(relationship.confidence)
        );
};
const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type' : 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    })
}
const jsonError = (status, message, extra ={}) => jsonResponse({ error: message, ...extra }, status);

const getUserProfile = async (userPuter) => {
    try {
        return await userPuter.auth.getUser();
    } catch {
        return null;
    }
}
const getGenerationLockKey = (ownerId, projectId) =>
    `${GENERATION_LOCK_PREFIX}${ownerId}:${projectId}`;
const releaseGenerationLock = async (ownerId, projectId) => {
    const key = getGenerationLockKey(ownerId, projectId);
    const current = await me.puter.kv.get(key);
    if (typeof current === 'number' && current > 0) {
        await me.puter.kv.incr(key, -1);
    }
};

const getPrivateAssetFileName = (value) => {
    if (typeof value !== 'string' || !value.startsWith(PRIVATE_ASSET_PREFIX)) return null;
    const fileName = value.slice(PRIVATE_ASSET_PREFIX.length);
    return /^[a-f0-9-]{36}\.(png|jpe?g|webp|gif)$/i.test(fileName)
        ? fileName
        : null;
}

const getPrivateAssetPath = (ownerId, fileName) =>
    `${PRIVATE_ASSET_ROOT}/${ownerId}/${fileName}`;

const getImageExtensionForType = (contentType) => ({
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
})[contentType];
const getImageTypeForExtension = (extension) => ({
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
})[extension];

const getPublicAssetPaths = (id, paths) => {
    if (!Array.isArray(paths)) return null;
    const safeId = encodeURIComponent(id).replace(/\./g, '%2E');
    const prefix = `projects/${safeId}/`;
    const validPaths = paths.filter((path) =>
        typeof path === 'string' &&
        path.startsWith(prefix) &&
        /^(source|rendered(?:-[A-Za-z0-9_-]{1,160})?)\.(png|jpe?g|webp|gif|svg)$/i
            .test(path.slice(prefix.length))
    );
    return validPaths.length === paths.length ? validPaths : null;
}

const getExactPublishedAssetPaths = (id, paths, images) => {
    const validPaths = getPublicAssetPaths(id, paths);
    const expectedPaths = images.map(getHostedPath);
    if (!validPaths || expectedPaths.some((path) => !path)) return null;
    const expected = [...new Set(expectedPaths)];
    return validPaths.length === expected.length &&
        new Set(validPaths).size === validPaths.length &&
        expected.every((path) => validPaths.includes(path))
        ? validPaths
        : null;
}

const deleteObsoletePublicAssets = async (userPuter, oldPaths, currentPaths) => {
    for (const path of oldPaths.filter((oldPath) => !currentPaths.includes(oldPath))) {
        try {
            await userPuter.fs.delete(path);
        } catch (error) {
            console.error(`Failed to revoke obsolete public render asset ${path}:`, error);
        }
    }
}

const isPublicHostedUrl = (value) => {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname.endsWith('.puter.site');
    } catch {
        return false;
    }
}

const getHostedPath = (value) => {
    if (!isPublicHostedUrl(value)) return null;
    return new URL(value).pathname.replace(/^\/+/, '');
}

router.post('/api/projects/private-asset', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const formData = await request.formData();
        const id = formData.get('id');
        const label = formData.get('label');
        const file = formData.get('file');
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        if (label !== 'source' && label !== 'rendered') return jsonError(400, 'Asset label is invalid');
        if (!file || typeof file.arrayBuffer !== 'function' || typeof file.type !== 'string') {
            return jsonError(400, 'Image file is required');
        }
        if (file.size > MAX_PRIVATE_ASSET_SIZE) return jsonError(413, 'Image must not exceed 50 MB');

        const mediaType = file.type.split(';', 1)[0].trim().toLowerCase();
        const normalizedType = mediaType === 'image/jpg' ? 'image/jpeg' : mediaType;
        const extension = getImageExtensionForType(normalizedType);
        if (!extension) return jsonError(400, `Unsupported image type: ${file.type || 'unknown'}`);

        const fileName = `${crypto.randomUUID()}.${extension}`;
        await me.puter.fs.write(getPrivateAssetPath(profile.uuid, fileName), file, {
            createMissingParents: true,
        });

        return jsonResponse({ asset: `${PRIVATE_ASSET_PREFIX}${fileName}` });
    } catch (e) {
        return jsonError(500, 'Failed to store private image', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.get('/api/projects/private-asset', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        const label = url.searchParams.get('label');
        if (!id) return jsonError(400, 'Project id is required');
        if (label !== 'source' && label !== 'rendered') return jsonError(400, 'Asset label is invalid');

        const project = await userPuter.kv.get(`${PROJECT_PREFIX}${profile.uuid}_${id}`)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if (!project || project.ownerId !== profile.uuid || project.isPublic) {
            return jsonError(404, 'Project not found');
        }

        const image = project[`${label}Image`];
        const fileName = getPrivateAssetFileName(image);
        if (!fileName) return jsonError(404, 'Private image not found');

        const blob = await me.puter.fs.read(getPrivateAssetPath(profile.uuid, fileName));
        const extension = fileName.split('.').pop().toLowerCase();
        const imageType = getImageExtensionForType(blob.type?.split(';', 1)[0].trim().toLowerCase())
            ? blob.type.split(';', 1)[0].trim().toLowerCase()
            : getImageTypeForExtension(extension);
        if (!imageType) return jsonError(500, 'Stored private image has an unsupported type');
        return new Response(await blob.arrayBuffer(), {
            headers: {
                'Content-Type': imageType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (e) {
        return jsonError(500, 'Failed to retrieve private image', {
            message: e instanceof Error ? e.message : String(e),
        });
    }
})

router.post('/api/projects/generation/authorize', async ({ request, user }) => {
    let ownerId;
    let projectId;
    let lockAcquired = false;
    let usageKey;
    let quotaCharged = false;
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        ownerId = profile.uuid;

        const body = await request.json();
        const id = body?.id;
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        if (body.generationMode !== undefined && !isValidGenerationMode(body.generationMode)) {
            return jsonError(400, 'Generation mode is invalid');
        }
        projectId = id;

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        let project = await userPuter.kv.get(privateKey);
        let projectKey = privateKey;
        if (!project) {
            const legacyProject = await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
            if (legacyProject?.ownerId === profile.uuid) {
                project = legacyProject;
                projectKey = `${PROJECT_PREFIX}${id}`;
            }
        }
        if (!project) {
            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
            if (publicProject && publicProject.ownerId !== profile.uuid) {
                return jsonError(403, 'Only the project owner can generate a render');
            }
        }
        if (!project) return jsonError(404, 'Project not found');
        if (project.ownerId !== profile.uuid) {
            return jsonError(403, 'Only the project owner can generate a render');
        }
        if (project.id !== id) return jsonError(404, 'Project not found');
        if (!project.sourceImage) return jsonError(400, 'Project source image is missing');
        const generationMode = body.generationMode ?? project.generationMode ?? 'baseline';
        if (!isValidGenerationMode(generationMode)) {
            return jsonError(400, 'Project generation mode is invalid');
        }
        const maximumVersionNumber = getRenderVersionMaxNumber(project);
        if (maximumVersionNumber === null) {
            return jsonError(409, 'Project render version metadata is invalid');
        }

        const previousMetadata = project.generationMetadata;
        if (isActiveGeneration(previousMetadata)) {
            return jsonError(409, 'A generation request is already in progress for this project');
        }

        let analysis;
        let configuration;
        const traceabilityAnalysis = isValidFloorPlanAnalysis(project.floorPlanAnalysis)
            ? project.floorPlanAnalysis
            : undefined;
        const traceabilityConfiguration = isValidRenderConfiguration(project.renderConfiguration)
            ? project.renderConfiguration
            : undefined;
        let traceabilityAnalysisRevision = traceabilityAnalysis &&
            Number.isSafeInteger(project.approvedAnalysisRevision) &&
            project.approvedAnalysisRevision > 0
            ? project.approvedAnalysisRevision
            : null;
        let approvedAnalysisRevision = null;
        if (generationMode === 'enhanced') {
            if (!traceabilityAnalysis) {
                return jsonError(400, 'Enhanced generation requires approved floor-plan analysis');
            }
            if (!traceabilityConfiguration) {
                return jsonError(400, 'Enhanced generation requires valid saved design settings');
            }
            analysis = traceabilityAnalysis;
            configuration = traceabilityConfiguration;
            approvedAnalysisRevision = traceabilityAnalysisRevision ?? 1;
            traceabilityAnalysisRevision = approvedAnalysisRevision;
        }

        const lockKey = getGenerationLockKey(profile.uuid, id);
        const lockCount = await me.puter.kv.incr(lockKey);
        if (lockCount > 1) {
            await me.puter.kv.incr(lockKey, -1);
            return jsonError(409, 'A generation request is already in progress for this project');
        }
        lockAcquired = true;
        const expirySet = await me.puter.kv.expire(lockKey, GENERATION_LOCK_TTL_SECONDS);
        if (expirySet !== true) {
            throw new Error('Could not set the generation lock expiration');
        }

        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        usageKey = `archvision_ai_generation:${profile.uuid}:${date}`;
        const usage = await me.puter.kv.incr(usageKey);
        quotaCharged = true;
        if (usage > MAX_DAILY_GENERATIONS) {
            await me.puter.kv.incr(usageKey, -1);
            quotaCharged = false;
            await releaseGenerationLock(profile.uuid, id);
            lockAcquired = false;
            const resetAt = Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 1,
            );
            return jsonError(429, 'Daily AI generation limit reached. Try again after 00:00 UTC.', {
                limit: MAX_DAILY_GENERATIONS,
                resetAt,
            });
        }

        const timestamp = now.toISOString();
        const versionId = crypto.randomUUID();
        const versionNumber = maximumVersionNumber + 1;
        const metadata = {
            generationMode,
            modelIdentifier: GENERATION_MODEL_IDENTIFIER,
            promptTemplateVersion: generationMode === 'baseline'
                ? BASELINE_PROMPT_TEMPLATE_VERSION
                : ENHANCED_PROMPT_TEMPLATE_VERSION,
            configurationSnapshot: configuration ?? null,
            approvedAnalysisRevision,
            generationTimestamp: timestamp,
            generationStatus: 'generating',
            versionId,
            versionNumber,
        };
        await userPuter.kv.set(projectKey, {
            ...project,
            ...(project.generationMode === undefined ? { generationMode } : {}),
            generationMetadata: metadata,
            activeGenerationContext: {
                versionId,
                versionNumber,
                generationMode,
                generationTimestamp: timestamp,
                traceabilityAnalysisRevision,
                traceabilityAnalysis,
                traceabilityConfiguration,
                ...(project.renderedImage &&
                    (!Array.isArray(project.renderVersions) || project.renderVersions.length === 0)
                    ? { legacyGenerationMetadata: project.generationMetadata }
                    : {}),
            },
            ...(generationMode === 'enhanced' ? { approvedAnalysisRevision } : {}),
            updatedAt: timestamp,
        });

        return jsonResponse({
            authorized: true,
            limit: MAX_DAILY_GENERATIONS,
            remaining: MAX_DAILY_GENERATIONS - usage,
            generationMode,
            generationTimestamp: timestamp,
            approvedAnalysisRevision,
            versionId,
            versionNumber,
            traceabilityAnalysisRevision,
            ...(traceabilityAnalysis ? { traceabilityAnalysis } : {}),
            ...(traceabilityConfiguration
                ? { traceabilityConfiguration }
                : {}),
            ...(generationMode === 'enhanced' ? { analysis, configuration } : {}),
        });
    } catch (e) {
        if (quotaCharged && usageKey) {
            try {
                await me.puter.kv.incr(usageKey, -1);
            } catch (quotaError) {
                console.error('Failed to release quota after generation authorization failure:', quotaError);
            }
        }
        if (lockAcquired && ownerId && projectId) {
            try {
                await releaseGenerationLock(ownerId, projectId);
            } catch (lockError) {
                console.error('Failed to release the generation lock:', lockError);
            }
        }
        return jsonError(500, 'Failed to authorize AI generation', {
            message: e instanceof Error ? e.message : String(e),
        });
    }
})

router.post('/api/projects/generation/fail', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        const body = await request.json();
        const id = body?.id;
        const generationTimestamp = body?.generationTimestamp;
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        if (typeof generationTimestamp !== 'string' ||
            !Number.isFinite(Date.parse(generationTimestamp))) {
            return jsonError(400, 'Generation timestamp is invalid');
        }

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        let project = await userPuter.kv.get(privateKey);
        let projectKey = privateKey;
        if (!project) {
            const legacyKey = `${PROJECT_PREFIX}${id}`;
            const legacyProject = await userPuter.kv.get(legacyKey);
            if (legacyProject?.ownerId === profile.uuid) {
                project = legacyProject;
                projectKey = legacyKey;
            }
        }
        if (!project || project.ownerId !== profile.uuid) {
            return jsonError(project ? 403 : 404, 'Project not found or not owned by the current user');
        }
        const metadata = project.generationMetadata;
        if (!isValidGenerationMetadata(metadata) ||
            metadata.generationStatus !== 'generating' ||
            metadata.generationTimestamp !== generationTimestamp) {
            return jsonError(409, 'The active generation could not be marked as failed');
        }

        await userPuter.kv.set(projectKey, {
            ...project,
            generationMetadata: { ...metadata, generationStatus: 'failed' },
            activeGenerationContext: undefined,
            updatedAt: new Date().toISOString(),
        });
        await releaseGenerationLock(profile.uuid, id);
        return jsonResponse({ failed: true });
    } catch (e) {
        return jsonError(500, 'Failed to record the generation failure', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/render-versions/asset', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');
        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const formData = await request.formData();
        const id = formData.get('id');
        const versionId = formData.get('versionId');
        const generationTimestamp = formData.get('generationTimestamp');
        const file = formData.get('file');
        if (typeof id !== 'string' || !id.trim() ||
            typeof versionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(versionId) ||
            typeof generationTimestamp !== 'string' ||
            !Number.isFinite(Date.parse(generationTimestamp))) {
            return jsonError(400, 'Render version identifiers are invalid');
        }
        if (!file || typeof file.arrayBuffer !== 'function' || typeof file.type !== 'string') {
            return jsonError(400, 'Render image file is required');
        }
        if (file.size > MAX_PRIVATE_ASSET_SIZE) {
            return jsonError(413, 'Image must not exceed 50 MB');
        }
        const mediaType = file.type.split(';', 1)[0].trim().toLowerCase();
        const normalizedType = mediaType === 'image/jpg' ? 'image/jpeg' : mediaType;
        const extension = getImageExtensionForType(normalizedType);
        if (!extension) return jsonError(400, 'Unsupported render image type');

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        let project = await userPuter.kv.get(privateKey);
        if (!project) {
            const legacyKey = `${PROJECT_PREFIX}${id}`;
            const legacyProject = await userPuter.kv.get(legacyKey);
            if (legacyProject?.ownerId === profile.uuid) {
                project = legacyProject;
            }
        }
        const active = project?.generationMetadata;
        if (!project || project.ownerId !== profile.uuid || project.id !== id) {
            return jsonError(project ? 403 : 404, 'Project not found or not owned by the current user');
        }
        if (!isValidGenerationMetadata(active) ||
            active.generationStatus !== 'generating' ||
            active.generationTimestamp !== generationTimestamp ||
            active.versionId !== versionId ||
            !project.activeGenerationContext ||
            project.activeGenerationContext.versionId !== versionId) {
            return jsonError(409, 'The render asset does not match the active authorized generation');
        }

        const fileName = `${versionId}.${extension}`;
        const assetPath = getPrivateAssetPath(profile.uuid, fileName);
        try {
            await me.puter.fs.write(assetPath, file, { createMissingParents: true });
        } catch (e) {
            try {
                await me.puter.fs.delete(assetPath);
            } catch (cleanupError) {
                console.error('Failed to clean up a partial render image:', cleanupError);
            }
            throw e;
        }
        return jsonResponse({ asset: `${PRIVATE_ASSET_PREFIX}${fileName}` });
    } catch (e) {
        return jsonError(500, 'Failed to store render version image', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/render-versions/asset/delete', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');
        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        const body = await request.json();
        const { id, versionId, generationTimestamp, imageAssetReference } = body ?? {};
        if (typeof id !== 'string' || !id.trim() ||
            typeof versionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(versionId) ||
            typeof generationTimestamp !== 'string' ||
            !Number.isFinite(Date.parse(generationTimestamp))) {
            return jsonError(400, 'Render version identifiers are invalid');
        }
        const fileName = getPrivateAssetFileName(imageAssetReference);
        if (!fileName) return jsonError(400, 'Render image reference is invalid');

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        const project = await userPuter.kv.get(privateKey);
        if (!project || project.ownerId !== profile.uuid || project.id !== id) {
            return jsonError(project ? 403 : 404, 'Project not found or not owned by the current user');
        }
        const referencedByVersion = Array.isArray(project.renderVersions) &&
            project.renderVersions.some((version) =>
                version?.imageAssetReference === imageAssetReference);
        const referencedByProject = project.renderedImage === imageAssetReference;
        if (referencedByVersion || referencedByProject) {
            return jsonResponse({ deleted: false, retained: true });
        }
        const active = project.generationMetadata;
        if (!fileName.startsWith(`${versionId}.`)) {
            return jsonError(400, 'Render image reference does not match its version');
        }
        if (!isValidGenerationMetadata(active) ||
            active.generationStatus !== 'generating' ||
            active.generationTimestamp !== generationTimestamp ||
            active.versionId !== versionId) {
            return jsonError(409, 'The render asset is not part of the active authorized generation');
        }
        await me.puter.fs.delete(getPrivateAssetPath(profile.uuid, fileName));
        return jsonResponse({ deleted: true });
    } catch (e) {
        return jsonError(500, 'Failed to remove uncommitted render image', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/render-versions/commit', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');
        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        const body = await request.json();
        const id = body?.id;
        const versionId = body?.versionId;
        const generationTimestamp = body?.generationTimestamp;
        const imageAssetReference = body?.imageAssetReference;
        const generationLatencyMs = body?.generationLatencyMs;
        const imageFileName = getPrivateAssetFileName(imageAssetReference);
        if (typeof id !== 'string' || !id.trim() ||
            typeof versionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(versionId) ||
            typeof generationTimestamp !== 'string' ||
            !Number.isFinite(Date.parse(generationTimestamp)) ||
            !imageFileName ||
            !imageFileName.startsWith(`${versionId}.`) ||
            !Number.isSafeInteger(generationLatencyMs) ||
            generationLatencyMs < 0 || generationLatencyMs > 1800000) {
            return jsonError(400, 'Render version metadata is invalid');
        }

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        let project = await userPuter.kv.get(privateKey);
        let projectKey = privateKey;
        if (!project) {
            const legacyKey = `${PROJECT_PREFIX}${id}`;
            const legacyProject = await userPuter.kv.get(legacyKey);
            if (legacyProject?.ownerId === profile.uuid) {
                project = legacyProject;
                projectKey = legacyKey;
            }
        }
        if (!project || project.ownerId !== profile.uuid || project.id !== id) {
            return jsonError(project ? 403 : 404, 'Project not found or not owned by the current user');
        }
        const active = project.generationMetadata;
        const context = project.activeGenerationContext;
        if (!isValidGenerationMetadata(active) ||
            active.generationStatus !== 'generating' ||
            active.generationTimestamp !== generationTimestamp ||
            active.versionId !== versionId ||
            !context ||
            context.versionId !== versionId ||
            context.generationTimestamp !== generationTimestamp) {
            return jsonError(409, 'The render does not match the active authorized generation');
        }
        await me.puter.fs.read(getPrivateAssetPath(profile.uuid, imageFileName));
        if (Array.isArray(project.renderVersions) &&
            project.renderVersions.some((version) => version.id === versionId)) {
            return jsonError(409, 'This render version already exists');
        }
        const maximumVersionNumber = getRenderVersionMaxNumber(project);
        if (maximumVersionNumber === null || maximumVersionNumber + 1 !== context.versionNumber) {
            return jsonError(409, 'Render version numbering changed during generation');
        }

        const version = {
            id: versionId,
            projectId: id,
            versionNumber: context.versionNumber,
            imageAssetReference,
            generationMode: context.generationMode,
            modelIdentifier: active.modelIdentifier,
            promptTemplateVersion: active.promptTemplateVersion,
            configurationSnapshot: context.traceabilityConfiguration ?? null,
            approvedAnalysisRevision: context.traceabilityAnalysisRevision,
            ...(context.traceabilityAnalysis
                ? { approvedAnalysisSnapshot: context.traceabilityAnalysis }
                : {}),
            createdAt: new Date().toISOString(),
            generationLatencyMs,
            generationStatus: 'complete',
        };
        if (!isValidRenderVersion(version, id)) {
            return jsonError(500, 'The authorized render version metadata is invalid');
        }
        const renderVersions = !Array.isArray(project.renderVersions) ||
            project.renderVersions.length === 0
            ? [
                ...(project.renderedImage
                    ? [toLegacyRenderVersion({
                        ...project,
                        generationMetadata: context.legacyGenerationMetadata ??
                            project.generationMetadata,
                    })]
                    : []),
                version,
            ]
            : [...project.renderVersions, version];
        if (!renderVersions.every((candidate) => isValidRenderVersion(candidate, id))) {
            return jsonError(409, 'Existing render version metadata is invalid');
        }
        const completedMetadata = {
            ...active,
            generationStatus: 'complete',
            generationLatencyMs,
        };
        const updatedProject = {
            ...project,
            renderVersions,
            activeRenderVersionId: versionId,
            renderedImage: imageAssetReference,
            renderedPath: imageAssetReference,
            generationMetadata: completedMetadata,
            activeGenerationContext: undefined,
            updatedAt: new Date().toISOString(),
        };
        await userPuter.kv.set(projectKey, updatedProject);
        await releaseGenerationLock(profile.uuid, id);
        return jsonResponse({ project: updatedProject, version });
    } catch (e) {
        return jsonError(500, 'Failed to save render version metadata', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.get('/api/projects/render-versions/asset', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');
        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        const versionId = url.searchParams.get('versionId');
        if (!id || !versionId || !/^(?:[a-f0-9-]{36}|legacy_[a-f0-9]{1,16})$/i.test(versionId)) {
            return jsonError(400, 'Render version identifiers are invalid');
        }
        const project = await userPuter.kv.get(`${PROJECT_PREFIX}${profile.uuid}_${id}`)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if (!project || project.ownerId !== profile.uuid || project.id !== id || project.isPublic) {
            return jsonError(404, 'Project not found');
        }
        const version = Array.isArray(project.renderVersions) &&
            project.renderVersions.length > 0
            ? project.renderVersions.find((candidate) => candidate.id === versionId)
            : versionId === getLegacyVersionId(id)
                ? toLegacyRenderVersion(project)
                : null;
        if (!version || !isValidRenderVersion(version, id)) {
            return jsonError(404, 'Render version not found');
        }
        const fileName = getPrivateAssetFileName(version.imageAssetReference);
        if (!fileName) return jsonError(404, 'Private render image not found');
        const blob = await me.puter.fs.read(getPrivateAssetPath(profile.uuid, fileName));
        const extension = fileName.split('.').pop().toLowerCase();
        const imageType = getImageExtensionForType(blob.type?.split(';', 1)[0].trim().toLowerCase())
            ? blob.type.split(';', 1)[0].trim().toLowerCase()
            : getImageTypeForExtension(extension);
        if (!imageType) return jsonError(500, 'Stored private render has an unsupported type');
        return new Response(await blob.arrayBuffer(), {
            headers: {
                'Content-Type': imageType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (e) {
        return jsonError(500, 'Failed to retrieve private render version', {
            message: e instanceof Error ? e.message : String(e),
        });
    }
})

router.post('/api/projects/render-versions/active', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');
        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        const body = await request.json();
        const { id, versionId } = body ?? {};
        if (typeof id !== 'string' || !id.trim() ||
            typeof versionId !== 'string' ||
            !/^(?:[a-f0-9-]{36}|legacy_[a-f0-9]{1,16})$/i.test(versionId)) {
            return jsonError(400, 'Render version identifiers are invalid');
        }
        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        const project = await userPuter.kv.get(privateKey)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if (!project || project.ownerId !== profile.uuid || project.id !== id) {
            return jsonError(project ? 403 : 404, 'Project not found or not owned by the current user');
        }
        const versions = Array.isArray(project.renderVersions) &&
            project.renderVersions.length > 0
            ? project.renderVersions
            : [toLegacyRenderVersion(project)].filter(Boolean);
        const version = versions.find((candidate) => candidate.id === versionId);
        if (!version || !isValidRenderVersion(version, id)) {
            return jsonError(404, 'Render version not found');
        }
        const updatedProject = {
            ...project,
            renderVersions: project.renderVersions?.length ? project.renderVersions : versions,
            activeRenderVersionId: version.id,
            renderedImage: version.imageAssetReference,
            renderedPath: version.imageAssetReference,
            updatedAt: new Date().toISOString(),
        };
        await userPuter.kv.set(privateKey, updatedProject);
        return jsonResponse({ project: updatedProject });
    } catch (e) {
        return jsonError(500, 'Failed to select active render version', {
            message: e instanceof Error ? e.message : String(e),
        });
    }
})

router.post('/api/projects/render-versions/update', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');
        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        const body = await request.json();
        const { id, versionId, name, notes } = body ?? {};
        if (typeof id !== 'string' || !id.trim() ||
            typeof versionId !== 'string' ||
            !/^(?:[a-f0-9-]{36}|legacy_[a-f0-9]{1,16})$/i.test(versionId) ||
            (name !== undefined && (typeof name !== 'string' || name.length > 80)) ||
            (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) ||
            name === undefined && notes === undefined) {
            return jsonError(400, 'Render version details are invalid');
        }
        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        const project = await userPuter.kv.get(privateKey)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if (!project || project.ownerId !== profile.uuid || project.id !== id) {
            return jsonError(project ? 403 : 404, 'Project not found or not owned by the current user');
        }
        const versions = Array.isArray(project.renderVersions) &&
            project.renderVersions.length > 0
            ? project.renderVersions
            : [toLegacyRenderVersion(project)].filter(Boolean);
        const index = versions.findIndex((version) => version.id === versionId);
        if (index < 0 || !isValidRenderVersion(versions[index], id)) {
            return jsonError(404, 'Render version not found');
        }
        const updatedVersions = [...versions];
        updatedVersions[index] = {
            ...versions[index],
            ...(name !== undefined ? { name } : {}),
            ...(notes !== undefined ? { notes } : {}),
        };
        const updatedProject = {
            ...project,
            renderVersions: updatedVersions,
            activeRenderVersionId: project.activeRenderVersionId ??
                getLegacyVersionId(id),
            updatedAt: new Date().toISOString(),
        };
        await userPuter.kv.set(privateKey, updatedProject);
        return jsonResponse({ project: updatedProject });
    } catch (e) {
        return jsonError(500, 'Failed to update render version details', {
            message: e instanceof Error ? e.message : String(e),
        });
    }
})

router.post('/api/projects/save', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;

        if(!userPuter) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const project = body?.project;

        if(!project?.id || !project?.sourceImage) return jsonError(400, 'Project ID and source image are required');
        if (project.generationMode !== undefined &&
            !isValidGenerationMode(project.generationMode)) {
            return jsonError(400, 'Project generation mode is invalid');
        }
        if (project.generationMetadata !== undefined &&
            !isValidGenerationMetadata(project.generationMetadata)) {
            return jsonError(400, 'Generation metadata is invalid');
        }
        if (project.renderConfiguration !== undefined &&
            !isValidRenderConfiguration(project.renderConfiguration)) {
            return jsonError(400, 'Design settings are invalid');
        }

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${project.id}`;
        let existingPrivateProject = await userPuter.kv.get(privateKey);
        if (!existingPrivateProject) {
            const legacyProject = await userPuter.kv.get(`${PROJECT_PREFIX}${project.id}`);
            if (legacyProject?.ownerId === profile.uuid) {
                existingPrivateProject = legacyProject;
            }
        }
        if (existingPrivateProject?.ownerId &&
            existingPrivateProject.ownerId !== profile.uuid) {
            return jsonError(403, 'Only the project owner can update this project');
        }
        if (project.approvedAnalysisRevision !== undefined &&
            project.approvedAnalysisRevision !== existingPrivateProject?.approvedAnalysisRevision) {
            return jsonError(400, 'Approved analysis revision is managed by the Worker');
        }
        if (existingPrivateProject?.generationMode !== undefined &&
            project.generationMode !== undefined &&
            project.generationMode !== existingPrivateProject.generationMode) {
            return jsonError(409, 'Generation mode cannot be changed after project creation');
        }
        if (body?.visibility !== 'public' &&
            existingPrivateProject?.sourceImage &&
            project.sourceImage !== existingPrivateProject.sourceImage) {
            return jsonError(409, 'A project source floor plan cannot be replaced');
        }
        if (existingPrivateProject?.renderedImage &&
            project.renderedImage !== undefined &&
            project.renderedImage !== existingPrivateProject.renderedImage) {
            return jsonError(409, 'A successfully generated render cannot be overwritten');
        }
        if (!existingPrivateProject?.renderedImage && project.renderedImage) {
            const activeMetadata = existingPrivateProject?.generationMetadata;
            if (!isValidGenerationMetadata(activeMetadata) ||
                activeMetadata.generationStatus !== 'generating') {
                return jsonError(409, 'A render requires an active Worker generation authorization');
            }
        }
        if (project.generationMetadata !== undefined) {
            const previousMetadata = existingPrivateProject?.generationMetadata;
            if (!isValidGenerationMetadata(previousMetadata) ||
                previousMetadata.generationStatus !== 'generating' ||
                project.generationMetadata.generationStatus !== 'complete' ||
                project.generationMetadata.generationMode !== previousMetadata.generationMode ||
                (project.generationMode !== undefined &&
                    project.generationMode !== previousMetadata.generationMode) ||
                project.generationMetadata.generationTimestamp !== previousMetadata.generationTimestamp ||
                project.generationMetadata.approvedAnalysisRevision !==
                    previousMetadata.approvedAnalysisRevision ||
                JSON.stringify(project.generationMetadata.configurationSnapshot) !==
                    JSON.stringify(previousMetadata.configurationSnapshot) ||
                !project.renderedImage) {
                return jsonError(409, 'The render does not match the active authorized generation');
            }
        }
        const {
            floorPlanAnalysis: _untrustedFloorPlanAnalysis,
            renderConfiguration: _untrustedRenderConfiguration,
            renderVersions: _untrustedRenderVersions,
            activeRenderVersionId: _untrustedActiveRenderVersionId,
            activeGenerationContext: _untrustedActiveGenerationContext,
            renderVersionImages: _untrustedRenderVersionImages,
            fidelityEvaluations: _untrustedFidelityEvaluations,
            ...projectFields
        } = project;
        const payload = {
            ...existingPrivateProject,
            ...projectFields,
            ...(existingPrivateProject?.renderVersions !== undefined
                ? { renderVersions: existingPrivateProject.renderVersions }
                : {}),
            ...(existingPrivateProject?.activeRenderVersionId !== undefined
                ? { activeRenderVersionId: existingPrivateProject.activeRenderVersionId }
                : {}),
            ownerId: profile.uuid,
            isPublic: false,
            updatedAt: new Date().toISOString(),
        };

        if (body?.visibility === 'public') {
            if (!isPublicHostedUrl(project.sourceImage) ||
                (project.renderedImage && !isPublicHostedUrl(project.renderedImage))) {
                return jsonError(400, 'Public project images must use hosted image URLs');
            }
            const publicAssetPaths = getExactPublishedAssetPaths(
                project.id,
                body.publicAssetPaths,
                [project.sourceImage, ...(project.renderedImage ? [project.renderedImage] : [])],
            );
            if (!publicAssetPaths) {
                return jsonError(400, 'Public image paths are invalid');
            }

            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${project.id}`);
            if (publicProject?.ownerId !== profile.uuid) {
                return jsonError(403, 'Only the project owner can update a shared project');
            }
            const privateProject = body.privateProject;
            if (privateProject?.id !== project.id ||
                !getPrivateAssetFileName(privateProject.sourceImage) ||
                    (privateProject.renderedImage && !getPrivateAssetFileName(privateProject.renderedImage)) ||
                    (privateProject.renderConfiguration !== undefined &&
                        !isValidRenderConfiguration(privateProject.renderConfiguration)) ||
                    (privateProject.generationMode !== undefined &&
                        !isValidGenerationMode(privateProject.generationMode)) ||
                    (privateProject.generationMetadata !== undefined &&
                        !isValidGenerationMetadata(privateProject.generationMetadata))) {
                return jsonError(400, 'A private image backup is required for shared projects');
            }
            const oldPaths = publicProject.publicAssetPaths === undefined
                ? []
                : getPublicAssetPaths(project.id, publicProject.publicAssetPaths);
            if (!oldPaths) return jsonError(500, 'Existing shared image paths are invalid');
            const publicPayload = withoutPrivateDesignData(payload);
            const updatedProject = {
                ...publicPayload,
                isPublic: true,
                sharedBy: publicProject.sharedBy,
                sharedAt: publicProject.sharedAt,
                publicAssetPaths,
            };
            const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${project.id}`;
            const previousPrivateProject = existingPrivateProject;
            if (previousPrivateProject?.sourceImage &&
                privateProject.sourceImage !== previousPrivateProject.sourceImage) {
                return jsonError(409, 'A project source floor plan cannot be replaced');
            }
            if (previousPrivateProject?.renderedImage &&
                privateProject.renderedImage !== previousPrivateProject.renderedImage) {
                return jsonError(409, 'A successfully generated render cannot be overwritten');
            }
            const {
                floorPlanAnalysis: _untrustedPrivateAnalysis,
                renderConfiguration: _untrustedPrivateConfiguration,
                approvedAnalysisRevision: _untrustedPrivateRevision,
                generationMetadata: _untrustedPrivateMetadata,
                fidelityEvaluations: _untrustedPrivateFidelityEvaluations,
                ...privateFields
            } = privateProject;
            await userPuter.kv.set(privateKey, {
                ...previousPrivateProject,
                ...privateFields,
                ownerId: profile.uuid,
                isPublic: false,
                ...(previousPrivateProject?.floorPlanAnalysis
                    ? { floorPlanAnalysis: previousPrivateProject.floorPlanAnalysis }
                    : {}),
                ...(previousPrivateProject?.renderConfiguration
                    ? { renderConfiguration: previousPrivateProject.renderConfiguration }
                    : {}),
                ...(previousPrivateProject?.approvedAnalysisRevision !== undefined
                    ? { approvedAnalysisRevision: previousPrivateProject.approvedAnalysisRevision }
                    : {}),
                ...(project.generationMetadata
                    ? { generationMetadata: project.generationMetadata }
                    : {}),
                updatedAt: new Date().toISOString(),
            })
            try {
                await me.puter.kv.set(`${PUBLIC_PROJECT_PREFIX}${project.id}`, updatedProject);
                if (project.generationMetadata?.generationStatus === 'complete') {
                    await releaseGenerationLock(profile.uuid, project.id);
                }
                await deleteObsoletePublicAssets(userPuter, oldPaths, publicAssetPaths);
            } catch (error) {
                if (previousPrivateProject) {
                    await userPuter.kv.set(privateKey, previousPrivateProject);
                } else {
                    await userPuter.kv.del(privateKey);
                }
                throw error;
            }
            return jsonResponse({ project: updatedProject });
        }

        if (!getPrivateAssetFileName(project.sourceImage) ||
            (project.renderedImage && !getPrivateAssetFileName(project.renderedImage))) {
            return jsonError(400, 'Private project images must use private image storage');
        }

        await userPuter.kv.set(privateKey, payload);
        if (project.generationMetadata?.generationStatus === 'complete') {
            await releaseGenerationLock(profile.uuid, project.id);
        }

        return jsonResponse({ project: payload });
    } catch (e) {
        return jsonError(500, 'Failed to save project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/floor-plan-analysis/authorize', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const id = body?.id;
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');

        let project = await userPuter.kv.get(`${PROJECT_PREFIX}${profile.uuid}_${id}`)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if (!project) {
            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
            if (publicProject?.ownerId === profile.uuid) project = publicProject;
            else if (publicProject) return jsonError(403, 'Only the project owner can analyze a floor plan');
        }
        if (!project) return jsonError(404, 'Project not found');
        if (project.ownerId && project.ownerId !== profile.uuid) {
            return jsonError(403, 'Only the project owner can analyze a floor plan');
        }
        if (!project.sourceImage) return jsonError(400, 'Project source image is missing');

        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const usageKey = `archvision_ai_generation:${profile.uuid}:${date}`;
        const usage = await me.puter.kv.incr(usageKey);
        if (usage > MAX_DAILY_GENERATIONS) {
            await me.puter.kv.incr(usageKey, -1);
            const resetAt = Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 1,
            );
            return jsonError(429, 'Daily AI usage limit reached. Try again after 00:00 UTC.', {
                limit: MAX_DAILY_GENERATIONS,
                resetAt,
            });
        }

        return jsonResponse({
            authorized: true,
            limit: MAX_DAILY_GENERATIONS,
            remaining: MAX_DAILY_GENERATIONS - usage,
        });
    } catch (e) {
        return jsonError(500, 'Failed to authorize floor-plan analysis', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/floor-plan-analysis/save', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const id = body?.id;
        const analysis = body?.analysis;
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        if (!isValidFloorPlanAnalysis(analysis)) {
            return jsonError(400, 'Floor-plan analysis is invalid');
        }

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        let project = await userPuter.kv.get(privateKey)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if (!project) {
            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
            if (publicProject?.ownerId === profile.uuid) project = publicProject;
            else if (publicProject) return jsonError(403, 'Only the project owner can save floor-plan analysis');
        }
        if (!project) return jsonError(404, 'Project not found');
        if (project.ownerId && project.ownerId !== profile.uuid) {
            return jsonError(403, 'Only the project owner can save floor-plan analysis');
        }
        if (!project.sourceImage) return jsonError(400, 'Project source image is missing');
        if (isActiveGeneration(project.generationMetadata)) {
            return jsonError(409, 'Analysis cannot be changed while generation is in progress');
        }

        const approvedAnalysisRevision =
            (Number.isSafeInteger(project.approvedAnalysisRevision) &&
                project.approvedAnalysisRevision > 0
                ? project.approvedAnalysisRevision
                : 0) + 1;
        await userPuter.kv.set(privateKey, {
            ...project,
            ownerId: profile.uuid,
            floorPlanAnalysis: analysis,
            approvedAnalysisRevision,
            updatedAt: new Date().toISOString(),
        });
        return jsonResponse({ analysis, approvedAnalysisRevision });
    } catch (e) {
        return jsonError(500, 'Failed to save floor-plan analysis', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/render-configuration/save', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const id = body?.id;
        const configuration = body?.configuration;
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        if (!isValidRenderConfiguration(configuration)) {
            return jsonError(400, 'Design settings are invalid');
        }

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        let project = await userPuter.kv.get(privateKey);
        if (!project) {
            const legacyProject = await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
            if (legacyProject?.ownerId === profile.uuid) {
                project = legacyProject;
            }
        }
        if (!project) {
            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
            if (publicProject?.ownerId !== profile.uuid) {
                return jsonError(publicProject ? 403 : 404,
                    publicProject ? 'Only the project owner can update design settings' : 'Project not found');
            }
            project = {
                ...withoutPrivateDesignData(publicProject),
                isPublic: false,
            };
        }
        if (project.ownerId && project.ownerId !== profile.uuid) {
            return jsonError(403, 'Only the project owner can update design settings');
        }
        if (!project.sourceImage) return jsonError(400, 'Project source image is missing');
        if (isActiveGeneration(project.generationMetadata)) {
            return jsonError(409, 'Design settings cannot be changed while generation is in progress');
        }

        await userPuter.kv.set(privateKey, {
            ...project,
            ownerId: profile.uuid,
            isPublic: false,
            renderConfiguration: configuration,
            updatedAt: new Date().toISOString(),
        });
        return jsonResponse({ configuration });
    } catch (e) {
        return jsonError(500, 'Failed to save design settings', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.get('/api/projects/fidelity-evaluations', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');
        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        const id = new URL(request.url).searchParams.get('id');
        if (!id || !id.trim()) return jsonError(400, 'Project id is required');
        const project = await userPuter.kv.get(`${PROJECT_PREFIX}${profile.uuid}_${id}`)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
        if (!project) return jsonError(404, 'Project not found');
        if (project.ownerId && project.ownerId !== profile.uuid) return jsonError(403, 'Only the project owner can access fidelity assessments');
        const versions = Array.isArray(project.renderVersions) && project.renderVersions.length
            ? project.renderVersions
            : [toLegacyRenderVersion(project)].filter(Boolean);
        const evaluations = project.fidelityEvaluations ?? [];
        if (!Array.isArray(evaluations) || evaluations.some((item) => !isValidFidelityEvaluation(item, project, versions, false))) {
            return jsonError(500, 'Stored fidelity assessments are invalid');
        }
        return jsonResponse({ evaluations });
    } catch (error) {
        return jsonError(500, 'Failed to retrieve fidelity assessments', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
});

router.post('/api/projects/fidelity-evaluations/save', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if (!userPuter) return jsonError(401, 'Authentication failed');
        const profile = await getUserProfile(userPuter);
        if (!profile?.uuid) return jsonError(401, 'Authentication failed');
        const body = await request.json();
        const id = body?.id;
        const evaluation = body?.evaluation;
        if (typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        let project = await userPuter.kv.get(privateKey);
        if (!project) {
            const legacy = await userPuter.kv.get(`${PROJECT_PREFIX}${id}`);
            if (legacy?.ownerId && legacy.ownerId !== profile.uuid) return jsonError(403, 'Only the project owner can save fidelity assessments');
            project = legacy;
        }
        if (!project) return jsonError(404, 'Project not found');
        if (project.ownerId && project.ownerId !== profile.uuid) return jsonError(403, 'Only the project owner can save fidelity assessments');
        const versions = Array.isArray(project.renderVersions) && project.renderVersions.length
            ? project.renderVersions
            : [toLegacyRenderVersion(project)].filter(Boolean);
        if (!isValidFidelityEvaluation(evaluation, project, versions)) return jsonError(400, 'Fidelity assessment is invalid or references another project/version');
        const existing = project.fidelityEvaluations ?? [];
        if (!Array.isArray(existing) || existing.some((item) => !isValidFidelityEvaluation(item, project, versions, false))) return jsonError(500, 'Stored fidelity assessments are invalid');
        if (existing.some((item) => item.id === evaluation.id)) return jsonError(409, 'Evaluation records are immutable; create a revision with a new id');
        if (evaluation.revisionOf && !existing.some((item) => item.id === evaluation.revisionOf && item.renderVersionId === evaluation.renderVersionId)) return jsonError(400, 'Revision target does not exist for this render version');
        const updated = { ...project, ownerId: profile.uuid, fidelityEvaluations: [...existing, evaluation], updatedAt: new Date().toISOString() };
        await userPuter.kv.set(privateKey, updated);
        return jsonResponse({ evaluation });
    } catch (error) {
        return jsonError(500, 'Failed to save fidelity assessment', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
});

router.get('/api/projects/list', async ({ user }) => {
    try {
        const userPuter = user?.puter;

        if(!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const userPrefix = `${PROJECT_PREFIX}${profile.uuid}_`;
        const publicProjects = (await me.puter.kv.list(PUBLIC_PROJECT_PREFIX, true))
            .map(({ value }) => withoutPrivateDesignData(value));
        const publicIds = new Set(
            publicProjects
                .filter(({ ownerId }) => ownerId === profile.uuid)
                .map(({ id }) => id),
        );
        const privateProjects = (await userPuter.kv.list(PROJECT_PREFIX, true))
            .filter(({ key, value }) =>
                key.startsWith(userPrefix) ||
                (key === `${PROJECT_PREFIX}${value?.id}` && !value?.ownerId)
            )
            .filter(({ value }) => !publicIds.has(value?.id))
            .map(({ value }) => ({ ...value, isPublic: false }));
        const projects = [...privateProjects, ...publicProjects]
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        return jsonResponse({ projects });
    } catch (e) {
        return jsonError(500, 'Failed to list projects', {
            message: e.message || 'Unknown error',
        });
    }
})

router.get('/api/projects/get', async ({ request, user }) => {
    try {
        const id = new URL(request.url).searchParams.get('id');
        if(!id) return jsonError(400, 'Project id is required');

        const userPuter = user?.puter;

        if(!userPuter) {
            const publicProject = await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
            if(!publicProject) return jsonError(404, 'Project not found');

            return jsonResponse({ project: withoutPrivateDesignData(publicProject) });
        }

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const project = await userPuter.kv.get(`${PROJECT_PREFIX}${profile.uuid}_${id}`)
            ?? await userPuter.kv.get(`${PROJECT_PREFIX}${id}`)
            ?? await me.puter.kv.get(`${PUBLIC_PROJECT_PREFIX}${id}`);
        if(project === undefined) return jsonError(404, 'Project not found');

        return jsonResponse({
            project: project.isPublic ? withoutPrivateDesignData(project) : project,
        });
    } catch (e) {
        return jsonError(500, 'Failed to get project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/share', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if(!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const id = body?.id;
        if(typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');
        if (body?.publicAssets?.renderVersionId !== undefined &&
            (typeof body.publicAssets.renderVersionId !== 'string' ||
                !/^(?:[a-f0-9-]{36}|legacy_[a-f0-9]{1,16})$/i
                    .test(body.publicAssets.renderVersionId))) {
            return jsonError(400, 'Public render version identifier is invalid');
        }
        const publicAssetPaths = getExactPublishedAssetPaths(
            id,
            body?.publicAssetPaths,
            [
                body?.publicAssets?.sourceImage,
                ...(body?.publicAssets?.renderedImage
                    ? [body.publicAssets.renderedImage]
                    : []),
            ],
        );
        if (!publicAssetPaths) return jsonError(400, 'Public image paths are invalid');
        if (!isPublicHostedUrl(body?.publicAssets?.sourceImage) ||
            (body.publicAssets.renderedImage && !isPublicHostedUrl(body.publicAssets.renderedImage))) {
            return jsonError(400, 'Public project images must use hosted image URLs');
        }
        if (!publicAssetPaths.includes(getHostedPath(body.publicAssets.sourceImage)) ||
            (body.publicAssets.renderedImage &&
                !publicAssetPaths.includes(getHostedPath(body.publicAssets.renderedImage)))) {
            return jsonError(400, 'Public image paths are invalid');
        }

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        const legacyPrivateKey = `${PROJECT_PREFIX}${id}`;
        const publicKey = `${PUBLIC_PROJECT_PREFIX}${id}`;
        let project = await userPuter.kv.get(privateKey);
        if (!project) {
            project = await userPuter.kv.get(legacyPrivateKey);
        }

        if (!project) {
            const existingPublic = await me.puter.kv.get(publicKey);
            if (existingPublic?.ownerId === profile.uuid) {
                return jsonResponse({ project: withoutPrivateDesignData(existingPublic) });
            }
            return jsonError(404, 'Private project not found');
        }
        if (project.ownerId !== profile.uuid || project.id !== id) {
            return jsonError(403, 'Only the project owner can share this project');
        }
        const storedVersions = Array.isArray(project.renderVersions)
            ? project.renderVersions
            : [];
        const selectedVersion = project.activeRenderVersionId
            ? storedVersions.find(({ id: versionId }) =>
                versionId === project.activeRenderVersionId)
            : storedVersions
                .slice()
                .sort((left, right) => right.versionNumber - left.versionNumber)[0] ??
            (!storedVersions.length ? toLegacyRenderVersion(project) : null);
        const selectedVersionId = selectedVersion?.id ?? null;
        if (project.renderedImage) {
            const renderedPath = getHostedPath(body.publicAssets.renderedImage);
            if (!selectedVersion ||
                !isValidRenderVersion(selectedVersion, id) ||
                selectedVersion.imageAssetReference !== project.renderedImage ||
                body.renderVersionId !== selectedVersionId ||
                !renderedPath ||
                !renderedPath.startsWith(
                    `projects/${encodeURIComponent(id).replace(/\./g, '%2E')}/rendered-${selectedVersionId}.`,
                )) {
                return jsonError(409, 'Only the active render version can be published');
            }
        } else if (body.publicAssets.renderedImage || body.renderVersionId) {
            return jsonError(400, 'A render cannot be published before a version exists');
        }

        const existingPublic = await me.puter.kv.get(publicKey);
        if (existingPublic && existingPublic.ownerId !== profile.uuid) {
            return jsonError(409, 'A public project with this id already exists');
        }
        const existingPaths = existingPublic?.publicAssetPaths === undefined
            ? []
            : getPublicAssetPaths(id, existingPublic.publicAssetPaths);
        if (!existingPaths) return jsonError(500, 'Existing shared image paths are invalid');

        const sharedAt = new Date().toISOString();
        const {
            floorPlanAnalysis: _floorPlanAnalysis,
            ...projectForPublicSharing
        } = project;
        const publicProject = {
            ...withoutPrivateDesignData(projectForPublicSharing),
            ownerId: profile.uuid,
            sharedBy: profile.username || 'Unknown user',
            sharedAt,
            isPublic: true,
            sourceImage: body.publicAssets.sourceImage,
            renderedImage: body.publicAssets.renderedImage || null,
            publicAssetPaths,
        };

        await me.puter.kv.set(publicKey, publicProject);
        await deleteObsoletePublicAssets(userPuter, existingPaths, publicAssetPaths);

        return jsonResponse({ project: publicProject });
    } catch (e) {
        return jsonError(500, 'Failed to share project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})

router.post('/api/projects/unshare', async ({ request, user }) => {
    try {
        const userPuter = user?.puter;
        if(!userPuter) return jsonError(401, 'Authentication failed');

        const profile = await getUserProfile(userPuter);
        if(!profile?.uuid) return jsonError(401, 'Authentication failed');

        const body = await request.json();
        const id = body?.id;
        if(typeof id !== 'string' || !id.trim()) return jsonError(400, 'Project id is required');

        const publicKey = `${PUBLIC_PROJECT_PREFIX}${id}`;
        const publicProject = await me.puter.kv.get(publicKey);
        if (!publicProject) return jsonError(404, 'Shared project not found');
        if (publicProject.ownerId !== profile.uuid) {
            return jsonError(403, 'Only the project owner can unshare this project');
        }

        const privateKey = `${PROJECT_PREFIX}${profile.uuid}_${id}`;
        const existingPrivate = await userPuter.kv.get(privateKey);

        const publicAssetPaths = publicProject.publicAssetPaths === undefined
            ? []
            : getPublicAssetPaths(id, publicProject.publicAssetPaths);
        if (!publicAssetPaths) return jsonError(500, 'Shared image paths are invalid');
        for (const path of publicAssetPaths) {
            await userPuter.fs.delete(path);
        }

        let privateProject = existingPrivate;
        if (!privateProject) {
            const {
                sharedBy: _sharedBy,
                sharedAt: _sharedAt,
                publicAssetPaths: _publicAssetPaths,
                ...project
            } = publicProject;
            privateProject = {
                ...project,
                isPublic: false,
                ownerId: profile.uuid,
                updatedAt: new Date().toISOString(),
            };
            await userPuter.kv.set(privateKey, privateProject);
        }

        await me.puter.kv.del(publicKey);
        return jsonResponse({ project: privateProject });
    } catch (e) {
        return jsonError(500, 'Failed to unshare project', {
            message: e instanceof Error ? e.message : 'Unknown error',
        });
    }
})
