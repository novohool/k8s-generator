import React, { useState } from 'react';
import { Copy, Download, Code, Settings, FileText, Database, Network, Shield } from 'lucide-react';
import { stringify as yamlStringify } from 'yaml';
// @ts-expect-error: js-yaml types may be missing
import yaml from 'js-yaml';

const K8sTypeScriptIaCGenerator: React.FC = () => {
  const [resourceType, setResourceType] = useState<string>('deployment');
  const [iacFramework, setIacFramework] = useState<string>('cdk8s');
  const [config, setConfig] = useState({
    name: 'my-app',
    namespace: 'default',
    image: 'nginx:latest',
    replicas: 3,
    port: 80,
    serviceType: 'ClusterIP',
    labels: 'app=my-app,version=v1',
    env: 'NODE_ENV=production,PORT=3000',
    cpu: '100m',
    memory: '128Mi',
    cpuLimit: '500m',
    memoryLimit: '256Mi',
    secretData: 'username=admin,password=123456',
    secretType: 'Opaque',
    configmapType: '',
    ingressHost: 'example.com',
    ingressPath: '/',
    ingressService: 'my-app-service',
    ingressServicePort: 80,
    pvcStorage: '1Gi',
    pvcAccessModes: 'ReadWriteOnce',
    pvcStorageClass: '',
    annotations: '',
    strategy: '',
    minReadySeconds: '',
    externalIPs: '',
    sessionAffinity: '',
    ingressClassName: '',
    volumeMode: '',
    volumeMountPath: '', // 新增：deployment 挂载 configmap/secret 路径
    storageClassProvisioner: '',
    storageClassParameters: '',
    secondaryPvcName: '',
    secondaryStorageClassName: '',
  });
  
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatedYaml, setGeneratedYaml] = useState('');
  const [activeTab, setActiveTab] = useState('form');

  const resourceTypes = [
    { value: 'deployment', label: 'Deployment', icon: Code },
    { value: 'service', label: 'Service', icon: Network },
    { value: 'configmap', label: 'ConfigMap', icon: Settings },
    { value: 'secret', label: 'Secret', icon: Shield },
    { value: 'ingress', label: 'Ingress', icon: Network },
    { value: 'pvc', label: 'PVC', icon: Database },
    { value: 'storageclass', label: 'StorageClass', icon: Database },
  ];

  const iacFrameworks = [
    { value: 'cdk8s', label: 'CDK8s', description: 'AWS CDK for Kubernetes' },
    { value: 'pulumi', label: 'Pulumi', description: 'Modern Infrastructure as Code' },
    { value: 'kubernetes-client', label: 'K8s Client', description: 'Official Kubernetes JavaScript Client' }
  ];

  const secondaryResourceOptions: Record<string, { value: string, label: string }[]> = {
    deployment: [
      { value: 'pvc', label: 'PersistentVolumeClaim' },
      { value: 'secret', label: 'Secret' },
      { value: 'configmap', label: 'ConfigMap' },
    ],
    service: [
      { value: 'ingress', label: 'Ingress' },
    ],
    ingress: [
      { value: 'secret', label: 'Secret' },
    ],
    secret: [
      { value: 'deployment', label: 'Deployment' },
      { value: 'ingress', label: 'Ingress' },
    ],
    configmap: [
      { value: 'deployment', label: 'Deployment' },
    ],
    pvc: [
      { value: 'storageclass', label: 'StorageClass' },
    ],
    storageclass: [
      { value: 'pvc', label: 'PersistentVolumeClaim' },
    ],
  };
  const [secondaryResourceType, setSecondaryResourceType] = useState<string>('');

  const parseLabels = (labelString: string) => {
    return labelString.split(',').reduce((acc, label) => {
      const [key, value] = label.split('=');
      acc[key?.trim()] = value?.trim() || '';
      return acc;
    }, {} as Record<string, string>);
  };

  const parseEnvVars = (envString: string) => {
    return envString.split(',').map(env => {
      const [name, value] = env.split('=');
      return { name: name?.trim(), value: value?.trim() || '' };
    });
  };

  const generateCDK8sCode = () => {
    const labels = parseLabels(config.labels);
    const envVars = parseEnvVars(config.env);
    let mainCode = '';
    // 智能联动变量
    let extraEnvFrom = '';
    let extraVolumes = '';
    let extraVolumeMounts = '';
    let extraTls = '';
    // deployment 智能联动
    if (resourceType === 'deployment') {
      if (secondaryResourceType === 'configmap') {
        extraEnvFrom = `envFrom: [ { configMapRef: { name: '${config.name}-config' } } ],`;
        if (config.volumeMountPath) {
          extraVolumeMounts = `volumeMounts: [ { name: '${config.name}-config', mountPath: '${config.volumeMountPath}', readOnly: true } ],`;
          extraVolumes = `volumes: [ { name: '${config.name}-config', configMap: { name: '${config.name}-config' } } ],`;
        }
      } else if (secondaryResourceType === 'secret') {
        extraEnvFrom = `envFrom: [ { secretRef: { name: '${config.name}-secret' } } ],`;
        if (config.volumeMountPath) {
          extraVolumeMounts = `volumeMounts: [ { name: '${config.name}-secret', mountPath: '${config.volumeMountPath}', readOnly: true } ],`;
          extraVolumes = `volumes: [ { name: '${config.name}-secret', secret: { secretName: '${config.name}-secret' } } ],`;
        }
      } else if (secondaryResourceType === 'pvc') {
        extraVolumeMounts = `volumeMounts: [ { name: '${config.name}-pvc', mountPath: '/mnt/data' } ],`;
        extraVolumes = `volumes: [ { name: '${config.name}-pvc', persistentVolumeClaim: { claimName: '${config.name}-pvc' } } ],`;
      }
    }
    // ingress 智能联动
    if (resourceType === 'ingress' && secondaryResourceType === 'secret' && config.secretType === 'kubernetes.io/tls') {
      extraTls = `tls: [ { hosts: ['${config.ingressHost}'], secretName: '${config.name}-secret' } ],`;
    }
    switch (resourceType) {
      case 'deployment':
        mainCode = `import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { KubeDeployment, KubeService } from 'cdk8s-plus-27';

export class ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}Chart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Create Deployment
    const deployment = new KubeDeployment(this, '${config.name}-deployment', {
      metadata: {
        name: '${config.name}',
        namespace: '${config.namespace}',
        labels: ${JSON.stringify(labels, null, 8)}
      },
      spec: {
        replicas: ${config.replicas},
        selector: {
          matchLabels: ${JSON.stringify(labels, null, 10)}
        },
        template: {
          metadata: {
            labels: ${JSON.stringify(labels, null, 12)}
          },
          spec: {
            containers: [{
              name: '${config.name}',
              image: '${config.image}',
              ports: [{ containerPort: ${config.port} }],
              env: [
${envVars.map(env => `                {
                  name: '${env.name}',
                  value: '${env.value}'
                }`).join(',\n')}
              ],
              resources: {
                requests: {
                  cpu: '${config.cpu}',
                  memory: '${config.memory}'
                },
                limits: {
                  cpu: '${config.cpuLimit}',
                  memory: '${config.memoryLimit}'
                }
              },
              ${extraEnvFrom}
              ${extraVolumeMounts}
            }],
            ${extraVolumes}
          }
        }
      }
    });

    // Create Service
    const service = new KubeService(this, '${config.name}-service', {
      metadata: {
        name: '${config.name}-service',
        namespace: '${config.namespace}',
        labels: ${JSON.stringify(labels, null, 8)}
      },
      spec: {
        type: '${config.serviceType}',
        ports: [{
          port: 80,
          targetPort: ${config.port},
          protocol: 'TCP'
        }],
        selector: ${JSON.stringify(labels, null, 8)}
      }
    });
  }
}`;
        break;
      case 'service':
        mainCode = `import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { KubeService } from 'cdk8s-plus-27';

export class ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}ServiceChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const service = new KubeService(this, '${config.name}-service', {
      metadata: {
        name: '${config.name}-service',
        namespace: '${config.namespace}',
        labels: ${JSON.stringify(labels, null, 8)}
      },
      spec: {
        type: '${config.serviceType}',
        ports: [{
          port: 80,
          targetPort: ${config.port},
          protocol: 'TCP'
        }],
        selector: ${JSON.stringify(labels, null, 8)}
      }
    });
  }
}`;
        break;
      case 'configmap':
        const configData = parseEnvVars(config.env).reduce((acc: Record<string, string>, env) => {
          acc[env.name] = env.value;
          return acc;
        }, {} as Record<string, string>);

        mainCode = `import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { KubeConfigMap } from 'cdk8s-plus-27';

export class ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}ConfigChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const configMap = new KubeConfigMap(this, '${config.name}-config', {
      metadata: {
        name: '${config.name}-config',
        namespace: '${config.namespace}'
      },
      ...(config.configmapType ? { type: config.configmapType } : {}),
      data: ${JSON.stringify(configData, null, 8)}
    });
  }
}`;
        break;
      case 'secret':
        const secretData = config.secretData.split(',').reduce((acc: Record<string, string>, pair) => {
          const [k, v] = pair.split('=');
          if (k && v) acc[k.trim()] = btoa(v.trim());
          return acc;
        }, {} as Record<string, string>);
        mainCode = `import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { KubeSecret } from 'cdk8s-plus-27';

export class ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}SecretChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);
    new KubeSecret(this, '${config.name}-secret', {
      metadata: {
        name: '${config.name}-secret',
        namespace: '${config.namespace}',
        labels: ${JSON.stringify(labels, null, 8)}
      },
      type: '${config.secretType}',
      stringData: ${JSON.stringify(secretData, null, 8)}
    });
  }
}`;
        break;
      case 'ingress':
        mainCode = `import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { KubeIngress } from 'cdk8s-plus-27';

export class ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}IngressChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);
    new KubeIngress(this, '${config.name}-ingress', {
      metadata: {
        name: '${config.name}-ingress',
        namespace: '${config.namespace}',
        labels: ${JSON.stringify(labels, null, 8)}
      },
      spec: {
        rules: [
          {
            host: '${config.ingressHost}',
            http: {
              paths: [
                {
                  path: '${config.ingressPath}',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: '${config.ingressService}',
                      port: { number: ${config.ingressServicePort} }
                    }
                  }
                }
              ]
            }
          }
        ],
        ${extraTls}
      }
    });
  }
}`;
        break;
      case 'pvc':
        mainCode = `import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { KubePersistentVolumeClaim } from 'cdk8s-plus-27';

export class ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}PVCChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);
    new KubePersistentVolumeClaim(this, '${config.name}-pvc', {
      metadata: {
        name: '${config.name}-pvc',
        namespace: '${config.namespace}',
        labels: ${JSON.stringify(labels, null, 8)}
      },
      spec: {
        accessModes: ['${config.pvcAccessModes}'],
        resources: {
          requests: {
            storage: '${config.pvcStorage}'
          }
        },
        ...(config.pvcStorageClass ? { storageClassName: config.pvcStorageClass } : {}),
      }
    });
  }
}`;
        break;
      case 'storageclass':
        // CDK8s StorageClass 代码生成
        const parametersObj = config.storageClassParameters
          ? config.storageClassParameters.split(',').reduce((acc: Record<string, string>, pair) => {
              const [k, v] = pair.split('=');
              if (k && v) acc[k.trim()] = v.trim();
              return acc;
            }, {} as Record<string, string>)
          : {};
        mainCode = `import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { KubeStorageClass } from 'cdk8s-plus-27';

export class ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}StorageClassChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);
    new KubeStorageClass(this, '${config.name}-storageclass', {
      metadata: { name: '${config.name}-storageclass' },
      provisioner: '${config.storageClassProvisioner}',
      parameters: ${JSON.stringify(parametersObj, null, 8)}
    });
  }
}`;
        break;
      default:
        mainCode = '';
    }
    // 二级资源代码
    let secondaryCode = '';
    if (secondaryResourceOptions[resourceType] && secondaryResourceOptions[resourceType].length > 0 && secondaryResourceType && secondaryResourceType !== '' && secondaryResourceType !== 'None') {
      switch (secondaryResourceType) {
        case 'pvc':
          secondaryCode = `// --- Secondary: PVC ---\nimport * as k8s from '@kubernetes/client-node';\n\nconst secondaryPvcManifest: k8s.V1PersistentVolumeClaim = {\n  apiVersion: 'v1',\n  kind: 'PersistentVolumeClaim',\n  metadata: {\n    name: '${config.secondaryPvcName || (config.name + "-pvc")}',\n    namespace: '${config.namespace}',\n    labels: ${JSON.stringify(labels, null, 8)}\n  },\n  spec: {\n    accessModes: ['${config.pvcAccessModes}'],\n    resources: {\n      requests: {\n        storage: '${config.pvcStorage}'\n      }\n    },\n    ${(config.pvcStorageClass ? `storageClassName: '${config.pvcStorageClass}',` : '')}\n    ${(config.volumeMode ? `volumeMode: '${config.volumeMode}',` : '')}\n  }\n};\n\nexport async function createSecondaryPVC() {\n  const kc = new k8s.KubeConfig();\n  kc.loadFromDefault();\n  const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);\n  try {\n    const response = await k8sCoreApi.createNamespacedPersistentVolumeClaim(\n      '${config.namespace}',\n      secondaryPvcManifest\n    );\n    return response.body;\n  } catch (error) {\n    console.error('Error creating secondary PVC:', error);\n    throw error;\n  }\n}`;
          break;
        case 'secret':
          const secondarySecretDataK8s = config.secretData.split(',').reduce((acc: Record<string, string>, pair) => { const [k, v] = pair.split('='); if (k && v) acc[k.trim()] = v.trim(); return acc; }, {} as Record<string, string>);
          secondaryCode = `// --- Secondary: Secret ---\nimport * as k8s from '@kubernetes/client-node';\n\nconst secondarySecretManifest: k8s.V1Secret = {\n  apiVersion: 'v1',\n  kind: 'Secret',\n  metadata: {\n    name: '${config.name}-secret',\n    namespace: '${config.namespace}',\n    labels: ${JSON.stringify(labels, null, 8)}\n  },\n  type: '${config.secretType}',\n  stringData: ${JSON.stringify(secondarySecretDataK8s, null, 8)}\n};\n\nexport async function createSecondarySecret() {\n  const kc = new k8s.KubeConfig();\n  kc.loadFromDefault();\n  const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);\n  try {\n    const response = await k8sCoreApi.createNamespacedSecret(\n      '${config.namespace}',\n      secondarySecretManifest\n    );\n    return response.body;\n  } catch (error) {\n    console.error('Error creating secondary Secret:', error);\n    throw error;\n  }\n}`;
          break;
        case 'configmap':
          const secondaryConfigDataK8s = parseEnvVars(config.env).reduce((acc: Record<string, string>, env) => { acc[env.name] = env.value; return acc; }, {} as Record<string, string>);
          secondaryCode = `// --- Secondary: ConfigMap ---\nimport * as k8s from '@kubernetes/client-node';\n\nconst secondaryConfigMapManifest: k8s.V1ConfigMap = {\n  apiVersion: 'v1',\n  kind: 'ConfigMap',\n  metadata: {\n    name: '${config.name}-config',\n    namespace: '${config.namespace}'\n  },\n  data: ${JSON.stringify(secondaryConfigDataK8s, null, 8)}\n};\n\nexport async function createSecondaryConfigMap() {\n  const kc = new k8s.KubeConfig();\n  kc.loadFromDefault();\n  const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);\n  try {\n    const response = await k8sCoreApi.createNamespacedConfigMap(\n      '${config.namespace}',\n      secondaryConfigMapManifest\n    );\n    return response.body;\n  } catch (error) {\n    console.error('Error creating secondary ConfigMap:', error);\n    throw error;\n  }\n}`;
          break;
        case 'ingress':
          // 主为secret，副为ingress时，只有secretType为kubernetes.io/tls时才生成ingress，且spec.tls自动带secretName
          if (resourceType === 'secret' && config.secretType === 'kubernetes.io/tls') {
            // Pulumi
            if (iacFramework === 'pulumi') {
              secondaryCode = `// --- Secondary: Ingress ---\nimport * as k8s from "@pulumi/kubernetes";\n\nconst secondaryIngress = new k8s.networking.v1.Ingress("${config.name}-ingress", {\n  metadata: {\n    name: "${config.name}-ingress",\n    namespace: "${config.namespace}",\n    labels: ${JSON.stringify(labels, null, 8)}\n  },\n  spec: {\n    rules: [\n      {\n        host: "${config.ingressHost}",\n        http: {\n          paths: [\n            {\n              path: "${config.ingressPath}",\n              pathType: "Prefix",\n              backend: {\n                service: {\n                  name: "${config.ingressService}",\n                  port: { number: ${config.ingressServicePort} }\n                }\n              }\n            }\n          ]\n        }\n      }\n    ],\n    tls: [\n      {\n        hosts: ["${config.ingressHost}"], secretName: "${config.name}-secret"\n      }\n    ]\n  }\n});\n\nexport const secondaryIngressName = secondaryIngress.metadata.name;`;
              break;
            }
            // K8s Client
            if (iacFramework === 'kubernetes-client') {
              secondaryCode = `// --- Secondary: Ingress ---\nimport * as k8s from '@kubernetes/client-node';\n\nconst secondaryIngressManifest: k8s.V1Ingress = {\n  apiVersion: 'networking.k8s.io/v1',\n  kind: 'Ingress',\n  metadata: {\n    name: '${config.name}-ingress',\n    namespace: '${config.namespace}',\n    labels: ${JSON.stringify(labels, null, 8)}\n  },\n  spec: {\n    rules: [\n      {\n        host: '${config.ingressHost}',\n        http: {\n          paths: [\n            {\n              path: '${config.ingressPath}',\n              pathType: 'Prefix',\n              backend: {\n                service: {\n                  name: '${config.ingressService}',\n                  port: { number: ${config.ingressServicePort} }\n                }\n              }\n            }\n          ]\n        }\n      }\n    ],\n    tls: [\n      {\n        hosts: ['${config.ingressHost}'],\n        secretName: '${config.name}-secret'\n      }\n    ]\n  }\n};\n\nexport async function createSecondaryIngress() {\n  const kc = new k8s.KubeConfig();\n  kc.loadFromDefault();\n  const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);\n  try {\n    const response = await k8sNetworkingApi.createNamespacedIngress(\n      '${config.namespace}',\n      secondaryIngressManifest\n    );\n    return response.body;\n  } catch (error) {\n    console.error('Error creating secondary Ingress:', error);\n    throw error;\n  }\n}`;
              break;
            }
            // YAML
            // 由generateK8sYaml自动处理（见下）
          } else if (resourceType === 'secret') {
            // 非TLS类型不生成
            secondaryCode = '';
            break;
          }
          // 其余情况按原有逻辑生成ingress代码
          secondaryCode = `// --- Secondary: Ingress ---\nimport * as k8s from '@kubernetes/client-node';\n\nconst secondaryIngressManifest: k8s.V1Ingress = {\n  apiVersion: 'networking.k8s.io/v1',\n  kind: 'Ingress',\n  metadata: {\n    name: '${config.name}-ingress',\n    namespace: '${config.namespace}',
    labels: ${JSON.stringify(labels, null, 8)}\n  },\n  spec: {\n    rules: [\n      {\n        host: '${config.ingressHost}',\n        http: {\n          paths: [\n            {\n              path: '${config.ingressPath}',\n              pathType: 'Prefix',\n              backend: {\n                service: {\n                  name: '${config.ingressService}',\n                  port: { number: ${config.ingressServicePort} }\n                }\n              }\n            }\n          ]\n        }\n      }\n    ]\n  }\n};\n\nexport async function createSecondaryIngress() {\n  const kc = new k8s.KubeConfig();\n  kc.loadFromDefault();\n  const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);\n  try {\n    const response = await k8sNetworkingApi.createNamespacedIngress(\n      '${config.namespace}',\n      secondaryIngressManifest\n    );\n    return response.body;\n  } catch (error) {\n    console.error('Error creating secondary Ingress:', error);\n    throw error;\n  }\n}`;
          break;
        case 'deployment':
          // 主为secret，副为deployment时，secondary deployment 代码应自动带有envFrom: secretRef
          if (resourceType === 'secret') {
            // CDK8s
            secondaryCode = `// --- Secondary: Deployment ---\nimport { Construct } from 'constructs';\nimport { Chart, ChartProps } from 'cdk8s';\nimport { KubeDeployment } from 'cdk8s-plus-27';\n\nexport class ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}SecondaryDeploymentChart extends Chart {\n  constructor(scope: Construct, id: string, props: ChartProps = {}) {\n    super(scope, id, props);\n    new KubeDeployment(this, '${config.name}-deployment', {\n      metadata: {\n        name: '${config.name}',\n        namespace: '${config.namespace}',\n        labels: ${JSON.stringify(labels, null, 8)}\n      },\n      spec: {\n        replicas: ${config.replicas},\n        selector: { matchLabels: ${JSON.stringify(labels, null, 12)} },\n        template: {\n          metadata: { labels: ${JSON.stringify(labels, null, 16)} },\n          spec: {\n            containers: [{\n              name: '${config.name}',\n              image: '${config.image}',\n              ports: [{ containerPort: ${config.port} }],\n              env: [${envVars.map(env => `\n                { name: '${env.name}', value: '${env.value}' }`).join(',')}\n              ],\n              envFrom: [ { secretRef: { name: '${config.name}-secret' } } ],\n              resources: {\n                requests: { cpu: '${config.cpu}', memory: '${config.memory}' },\n                limits: { cpu: '${config.cpuLimit}', memory: '${config.memoryLimit}' }\n              }\n            }]\n          }\n        }\n      }\n    });\n  }\n}`;
          } else if (iacFramework === 'pulumi') {
            // Pulumi
            secondaryCode = `// --- Secondary: Deployment ---\nimport * as k8s from "@pulumi/kubernetes";\n\nconst secondaryDeployment = new k8s.apps.v1.Deployment("${config.name}-deployment", {\n  metadata: {\n    name: "${config.name}",\n    namespace: "${config.namespace}",\n    labels: ${JSON.stringify(labels, null, 8)}\n  },\n  spec: {\n    replicas: ${config.replicas},\n    selector: { matchLabels: ${JSON.stringify(labels, null, 12)} },\n    template: {\n      metadata: { labels: ${JSON.stringify(labels, null, 16)} },\n      spec: {\n        containers: [{\n          name: "${config.name}",\n          image: "${config.image}",\n          ports: [{ containerPort: ${config.port} }],\n          env: [${envVars.map(env => `\n            { name: \"${env.name}\", value: \"${env.value}\" }`).join(',')}\n          ],\n          envFrom: [ { secretRef: { name: "${config.name}-secret" } } ],\n          resources: {\n            requests: { cpu: "${config.cpu}", memory: "${config.memory}" },\n            limits: { cpu: "${config.cpuLimit}", memory: "${config.memoryLimit}" }\n          }\n        }]\n      }\n    }\n  }\n});\n\nexport const secondaryDeploymentName = secondaryDeployment.metadata.name;`;
          } else if (iacFramework === 'kubernetes-client') {
            // K8s Client
            secondaryCode = `// --- Secondary: Deployment ---\nimport * as k8s from '@kubernetes/client-node';\n\nconst secondaryDeploymentManifest: k8s.V1Deployment = {\n  apiVersion: 'apps/v1',\n  kind: 'Deployment',\n  metadata: {\n    name: '${config.name}',\n    namespace: '${config.namespace}',\n    labels: ${JSON.stringify(labels, null, 8)}\n  },\n  spec: {\n    replicas: ${config.replicas},\n    selector: { matchLabels: ${JSON.stringify(labels, null, 12)} },\n    template: {\n      metadata: { labels: ${JSON.stringify(labels, null, 16)} },\n      spec: {\n        containers: [{\n          name: '${config.name}',\n          image: '${config.image}',\n          ports: [{ containerPort: ${config.port} }],\n          env: [${envVars.map(env => `\n            { name: '${env.name}', value: '${env.value}' }`).join(',')}\n          ],\n          envFrom: [ { secretRef: { name: '${config.name}-secret' } } ],\n          resources: {\n            requests: { cpu: '${config.cpu}', memory: '${config.memory}' },\n            limits: { cpu: '${config.cpuLimit}', memory: '${config.memoryLimit}' }\n          }\n        }]\n      }\n    }\n  }\n};\n\nexport async function createSecondaryDeployment() {\n  const kc = new k8s.KubeConfig();\n  kc.loadFromDefault();\n  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);\n  try {\n    const response = await k8sAppsApi.createNamespacedDeployment(\n      '${config.namespace}',\n      secondaryDeploymentManifest\n    );\n    return response.body;\n  } catch (error) {\n    console.error('Error creating secondary Deployment:', error);\n    throw error;\n  }\n}`;
          } else {
            // 默认兜底
            secondaryCode = '';
          }
          break;
        default:
          secondaryCode = '';
      }
    }
    return [mainCode, secondaryCode].filter(Boolean).join('\n\n// --- Secondary Resource ---\n\n');
  };

  const generatePulumiCode = () => {
    const labels = parseLabels(config.labels);
    const envVars = parseEnvVars(config.env);
    let mainCode = '';
    // 智能联动变量
    let extraEnvFrom = '';
    let extraVolumes = '';
    let extraVolumeMounts = '';
    let extraTls = '';
    if (resourceType === 'deployment') {
      if (secondaryResourceType === 'configmap') {
        extraEnvFrom = `envFrom: [ { configMapRef: { name: "${config.name}-config" } } ],`;
        if (config.volumeMountPath) {
          extraVolumeMounts = `volumeMounts: [ { name: "${config.name}-config", mountPath: "${config.volumeMountPath}", readOnly: true } ],`;
          extraVolumes = `volumes: [ { name: "${config.name}-config", configMap: { name: "${config.name}-config" } } ],`;
        }
      } else if (secondaryResourceType === 'secret') {
        extraEnvFrom = `envFrom: [ { secretRef: { name: "${config.name}-secret" } } ],`;
        if (config.volumeMountPath) {
          extraVolumeMounts = `volumeMounts: [ { name: "${config.name}-secret", mountPath: "${config.volumeMountPath}", readOnly: true } ],`;
          extraVolumes = `volumes: [ { name: "${config.name}-secret", secret: { secretName: "${config.name}-secret" } } ],`;
        }
      } else if (secondaryResourceType === 'pvc') {
        extraVolumeMounts = `volumeMounts: [ { name: "${config.name}-pvc", mountPath: "/mnt/data" } ],`;
        extraVolumes = `volumes: [ { name: "${config.name}-pvc", persistentVolumeClaim: { claimName: "${config.name}-pvc" } } ],`;
      }
    }
    if (resourceType === 'ingress' && secondaryResourceType === 'secret' && config.secretType === 'kubernetes.io/tls') {
      extraTls = `tls: [ { hosts: ["${config.ingressHost}"], secretName: "${config.name}-secret" } ],`;
    }
    switch (resourceType) {
      case 'deployment':
        mainCode = `import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

// Create a Deployment
const ${config.name}Deployment = new k8s.apps.v1.Deployment("${config.name}-deployment", {
    metadata: {
        name: "${config.name}",
        namespace: "${config.namespace}",
        labels: ${JSON.stringify(labels, null, 8)}
    },
    spec: {
        replicas: ${config.replicas},
        selector: {
            matchLabels: ${JSON.stringify(labels, null, 12)}
        },
        template: {
            metadata: {
                labels: ${JSON.stringify(labels, null, 16)}
            },
            spec: {
                containers: [{
                    name: "${config.name}",
                    image: "${config.image}",
                    ports: [{
                        containerPort: ${config.port}
                    }],
                    env: [
${envVars.map(env => `                        {
                            name: "${env.name}",
                            value: "${env.value}"
                        }`).join(',\n')}
                    ],
                    resources: {
                        requests: {
                            cpu: "${config.cpu}",
                            memory: "${config.memory}"
                        },
                        limits: {
                            cpu: "${config.cpuLimit}",
                            memory: "${config.memoryLimit}"
                        }
                    },
                    ${extraEnvFrom}
                    ${extraVolumeMounts}
                }],
                ${extraVolumes}
            }
        }
    }
});

// Create a Service
const ${config.name}Service = new k8s.core.v1.Service("${config.name}-service", {
    metadata: {
        name: "${config.name}-service",
        namespace: "${config.namespace}",
        labels: ${JSON.stringify(labels, null, 8)}
    },
    spec: {
        type: "${config.serviceType}",
        ports: [{
            port: 80,
            targetPort: ${config.port},
            protocol: "TCP"
        }],
        selector: ${JSON.stringify(labels, null, 8)}
    }
});

// Export the deployment and service names
export const deploymentName = ${config.name}Deployment.metadata.name;
export const serviceName = ${config.name}Service.metadata.name;`;
        break;
      case 'service':
        mainCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.name}Service = new k8s.core.v1.Service("${config.name}-service", {
    metadata: {
        name: "${config.name}-service",
        namespace: "${config.namespace}",
        labels: ${JSON.stringify(labels, null, 8)}
    },
    spec: {
        type: "${config.serviceType}",
        ports: [{
            port: 80,
            targetPort: ${config.port},
            protocol: "TCP"
        }],
        selector: ${JSON.stringify(labels, null, 8)}
    }
});

export const serviceName = ${config.name}Service.metadata.name;`;
        break;
      case 'configmap':
        const configData = parseEnvVars(config.env).reduce((acc: Record<string, string>, env) => {
          acc[env.name] = env.value;
          return acc;
        }, {} as Record<string, string>);

        mainCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.name}ConfigMap = new k8s.core.v1.ConfigMap("${config.name}-config", {
    metadata: {
        name: "${config.name}-config",
        namespace: "${config.namespace}"
    },
    data: ${JSON.stringify(configData, null, 8)}
});

export const configMapName = ${config.name}ConfigMap.metadata.name;`;
        break;
      case 'secret':
        const secretData = config.secretData.split(',').reduce((acc: Record<string, string>, pair) => {
          const [k, v] = pair.split('=');
          if (k && v) acc[k.trim()] = v.trim();
          return acc;
        }, {} as Record<string, string>);
        mainCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.name}Secret = new k8s.core.v1.Secret("${config.name}-secret", {
  metadata: {
    name: "${config.name}-secret",
    namespace: "${config.namespace}",
    labels: ${JSON.stringify(labels, null, 8)}
  },
  type: "${config.secretType}",
  stringData: ${JSON.stringify(secretData, null, 8)}
});

export const secretName = ${config.name}Secret.metadata.name;`;
        break;
      case 'ingress':
        mainCode = `import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

const ingressManifest: k8s.V1Ingress = {
  apiVersion: 'networking.k8s.io/v1',
  kind: 'Ingress',
  metadata: {
    name: '${config.name}-ingress',
    namespace: '${config.namespace}',
    labels: ${JSON.stringify(labels, null, 8)}
  },
  spec: {
    rules: [
      {
        host: '${config.ingressHost}',
        http: {
          paths: [
            {
              path: '${config.ingressPath}',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: '${config.ingressService}',
                  port: { number: ${config.ingressServicePort} }
                }
              }
            }
          ]
        }
      }
    ],
    ${extraTls}
  }
};

export async function createIngress() {
  try {
    const response = await k8sNetworkingApi.createNamespacedIngress(
      '${config.namespace}',
      ingressManifest
    );
    return response.body;
  } catch (error) {
    console.error('Error creating ingress:', error);
    throw error;
  }
}`;
        break;
      case 'pvc':
        // 只要主资源或副资源有 storageclass，pvc 的 storageClassName 必须固定
        const hasStorageClassPulumi = String(resourceType) === 'storageclass' || String(secondaryResourceType) === 'storageclass';
        mainCode = `import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

// Create a PVC
const ${config.name}PVC = new k8s.core.v1.PersistentVolumeClaim("${config.name}-pvc", {
    metadata: {
        name: "${config.name}-pvc",
        namespace: "${config.namespace}",
        labels: ${JSON.stringify(labels, null, 8)}
    },
    spec: {
        accessModes: ["${config.pvcAccessModes}"],
        resources: {
            requests: {
                storage: "${config.pvcStorage}"
            }
        },
        ${(hasStorageClassPulumi)
          ? `storageClassName: "${config.name}-storageclass",`
          : (config.pvcStorageClass ? `storageClassName: "${config.pvcStorageClass}",` : '')}
        ${(config.volumeMode ? `volumeMode: "${config.volumeMode}",` : '')}
    }
});

export const pvcName = ${config.name}PVC.metadata.name;`;
        break;
      case 'storageclass':
        // Pulumi StorageClass 代码生成
        const parametersObjP = config.storageClassParameters
          ? config.storageClassParameters.split(',').reduce((acc: Record<string, string>, pair) => {
              const [k, v] = pair.split('=');
              if (k && v) acc[k.trim()] = v.trim();
              return acc;
            }, {} as Record<string, string>)
          : {};
        mainCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.name}StorageClass = new k8s.storage.v1.StorageClass("${config.name}-storageclass", {
  metadata: { name: "${config.name}-storageclass" },
  provisioner: "${config.storageClassProvisioner}",
  parameters: ${JSON.stringify(parametersObjP, null, 8)}
});

export const storageClassName = ${config.name}StorageClass.metadata.name;`;
        break;
      default:
        mainCode = '';
    }
    let secondaryCode = '';
    if (secondaryResourceOptions[resourceType] && secondaryResourceOptions[resourceType].length > 0 && secondaryResourceType && secondaryResourceType !== '' && secondaryResourceType !== 'None') {
      switch (secondaryResourceType) {
        case 'pvc':
          secondaryCode = `// --- Secondary: PVC ---\n// ... pulumi pvc code ...`;
          break;
        case 'secret':
          secondaryCode = `// --- Secondary: Secret ---\n// ... pulumi secret code ...`;
          break;
        case 'configmap':
          secondaryCode = `// --- Secondary: ConfigMap ---\n// ... pulumi configmap code ...`;
          break;
        case 'ingress':
          secondaryCode = `// --- Secondary: Ingress ---\nimport * as k8s from "@pulumi/kubernetes";\n\nconst ${config.name}Ingress = new k8s.networking.v1.Ingress("${config.name}-ingress", {\n  metadata: {\n    name: "${config.name}-ingress",\n    namespace: "${config.namespace}",\n    labels: ${JSON.stringify(parseLabels(config.labels), null, 8)}\n  },\n  spec: {\n    ${(config.ingressClassName ? `ingressClassName: "${config.ingressClassName}",\n    ` : '')}rules: [\n      {\n        host: "${config.ingressHost}",\n        http: {\n          paths: [\n            {\n              path: "${config.ingressPath}",\n              pathType: "Prefix",\n              backend: {\n                service: {\n                  name: "${config.ingressService}",\n                  port: { number: ${config.ingressServicePort} }\n                }\n              }\n            }\n          ]\n        }\n      }\n    ]\n  }\n});`;
          break;
        case 'deployment':
          secondaryCode = `// --- Secondary: Deployment ---\n// ... pulumi deployment code ...`;
          break;
        default:
          secondaryCode = '';
      }
    }
    return [mainCode, secondaryCode].filter(Boolean).join('\n\n// --- Secondary Resource ---\n\n');
  };

  const generateK8sClientCode = () => {
    const labels = parseLabels(config.labels);
    const envVars = parseEnvVars(config.env);
    let mainCode = '';
    // 智能联动变量
    let extraEnvFrom = '';
    let extraVolumes = '';
    let extraVolumeMounts = '';
    let extraTls = '';
    if (resourceType === 'deployment') {
      if (secondaryResourceType === 'configmap') {
        extraEnvFrom = `envFrom: [ { configMapRef: { name: '${config.name}-config' } } ],`;
        if (config.volumeMountPath) {
          extraVolumeMounts = `volumeMounts: [ { name: '${config.name}-config', mountPath: '${config.volumeMountPath}', readOnly: true } ],`;
          extraVolumes = `volumes: [ { name: '${config.name}-config', configMap: { name: '${config.name}-config' } } ],`;
        }
      } else if (secondaryResourceType === 'secret') {
        extraEnvFrom = `envFrom: [ { secretRef: { name: '${config.name}-secret' } } ],`;
        if (config.volumeMountPath) {
          extraVolumeMounts = `volumeMounts: [ { name: '${config.name}-secret', mountPath: '${config.volumeMountPath}', readOnly: true } ],`;
          extraVolumes = `volumes: [ { name: '${config.name}-secret', secret: { secretName: '${config.name}-secret' } } ],`;
        }
      } else if (secondaryResourceType === 'pvc') {
        extraVolumeMounts = `volumeMounts: [ { name: '${config.name}-pvc', mountPath: '/mnt/data' } ],`;
        extraVolumes = `volumes: [ { name: '${config.name}-pvc', persistentVolumeClaim: { claimName: '${config.name}-pvc' } } ],`;
      }
    }
    if (resourceType === 'ingress' && secondaryResourceType === 'secret' && config.secretType === 'kubernetes.io/tls') {
      extraTls = `tls: [ { hosts: ['${config.ingressHost}'], secretName: '${config.name}-secret' } ],`;
    }
    switch (resourceType) {
      case 'deployment':
        mainCode = `import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

// Deployment configuration
const deploymentManifest: k8s.V1Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: '${config.name}',
        namespace: '${config.namespace}',
        labels: ${JSON.stringify(labels, null, 8)}
    },
    spec: {
        replicas: ${config.replicas},
        selector: {
            matchLabels: ${JSON.stringify(labels, null, 12)}
        },
        template: {
            metadata: {
                labels: ${JSON.stringify(labels, null, 16)}
            },
            spec: {
                containers: [{
                    name: '${config.name}',
                    image: '${config.image}',
                    ports: [{
                        containerPort: ${config.port}
                    }],
                    env: [
${envVars.map(env => `                        {
                            name: '${env.name}',
                            value: '${env.value}'
                        }`).join(',\n')}
                    ],
                    resources: {
                        requests: {
                            cpu: '${config.cpu}',
                            memory: '${config.memory}'
                        },
                        limits: {
                            cpu: '${config.cpuLimit}',
                            memory: '${config.memoryLimit}'
                        }
                    },
                    ${extraEnvFrom}
                    ${extraVolumeMounts}
                }],
                ${extraVolumes}
            }
        }
    }
};

// Service configuration
const serviceManifest: k8s.V1Service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
        name: '${config.name}-service',
        namespace: '${config.namespace}',
        labels: ${JSON.stringify(labels, null, 8)}
    },
    spec: {
        type: '${config.serviceType}',
        ports: [{
            port: 80,
            targetPort: ${config.port},
            protocol: 'TCP'
        }],
        selector: ${JSON.stringify(labels, null, 8)}
    }
};

// Deploy resources
export async function deploy${config.name.charAt(0).toUpperCase() + config.name.slice(1)}() {
    try {
        // Create deployment
        const deploymentResponse = await k8sAppsApi.createNamespacedDeployment(
            '${config.namespace}',
            deploymentManifest
        );
        console.log('Deployment created:', deploymentResponse.body.metadata?.name);

        // Create service
        const serviceResponse = await k8sCoreApi.createNamespacedService(
            '${config.namespace}',
            serviceManifest
        );
        console.log('Service created:', serviceResponse.body.metadata?.name);

        return {
            deployment: deploymentResponse.body,
            service: serviceResponse.body
        };
    } catch (error) {
        console.error('Error deploying resources:', error);
        throw error;
    }
}

// Usage: deploy${config.name.charAt(0).toUpperCase() + config.name.slice(1)}().then(console.log).catch(console.error);`;
        break;
      case 'ingress':
        mainCode = `import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

const ingressManifest: k8s.V1Ingress = {
  apiVersion: 'networking.k8s.io/v1',
  kind: 'Ingress',
  metadata: {
    name: '${config.name}-ingress',
    namespace: '${config.namespace}',
    labels: ${JSON.stringify(labels, null, 8)}
  },
  spec: {
    rules: [
      {
        host: '${config.ingressHost}',
        http: {
          paths: [
            {
              path: '${config.ingressPath}',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: '${config.ingressService}',
                  port: { number: ${config.ingressServicePort} }
                }
              }
            }
          ]
        }
      }
    ],
    ${extraTls}
  }
};

export async function createIngress() {
  try {
    const response = await k8sNetworkingApi.createNamespacedIngress(
      '${config.namespace}',
      ingressManifest
    );
    return response.body;
  } catch (error) {
    console.error('Error creating ingress:', error);
    throw error;
  }
}`;
        break;
      case 'secret':
        const secretData = config.secretData.split(',').reduce((acc: Record<string, string>, pair) => {
          const [k, v] = pair.split('=');
          if (k && v) acc[k.trim()] = v.trim();
          return acc;
        }, {} as Record<string, string>);
        mainCode = `import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

const secretManifest: k8s.V1Secret = {
  apiVersion: 'v1',
  kind: 'Secret',
  metadata: {
    name: '${config.name}-secret',
    namespace: '${config.namespace}',
    labels: ${JSON.stringify(labels, null, 8)}
  },
  type: '${config.secretType}',
  stringData: ${JSON.stringify(secretData, null, 8)}
};

export async function createSecret() {
  try {
    const response = await k8sCoreApi.createNamespacedSecret(
      '${config.namespace}',
      secretManifest
    );
    return response.body;
  } catch (error) {
    console.error('Error creating secret:', error);
    throw error;
  }
}`;
        break;
      case 'pvc':
        // 只要主资源或副资源有 storageclass，pvc 的 storageClassName 必须固定
        const hasStorageClassCode = String(resourceType) === 'storageclass' || String(secondaryResourceType) === 'storageclass';
        mainCode = `import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

const pvcManifest: k8s.V1PersistentVolumeClaim = {
  apiVersion: 'v1',
  kind: 'PersistentVolumeClaim',
  metadata: {
    name: '${config.name}-pvc',
    namespace: '${config.namespace}',
    labels: ${JSON.stringify(labels, null, 8)}
  },
  spec: {
    accessModes: ['${config.pvcAccessModes}'],
    resources: {
      requests: {
        storage: '${config.pvcStorage}'
      }
    },
    ${(hasStorageClassCode)
      ? `storageClassName: '${config.name}-storageclass',`
      : (config.pvcStorageClass ? `storageClassName: '${config.pvcStorageClass}',` : '')}
    ${(config.volumeMode ? `volumeMode: '${config.volumeMode}',` : '')}
  }
};

export async function createPVC() {
  try {
    const response = await k8sCoreApi.createNamespacedPersistentVolumeClaim(
      '${config.namespace}',
      pvcManifest
    );
    return response.body;
  } catch (error) {
    console.error('Error creating PVC:', error);
    throw error;
  }
}`;
        break;
      case 'storageclass':
        // k8s client StorageClass 代码生成
        const parametersObjK = config.storageClassParameters
          ? config.storageClassParameters.split(',').reduce((acc: Record<string, string>, pair) => {
              const [k, v] = pair.split('=');
              if (k && v) acc[k.trim()] = v.trim();
              return acc;
            }, {} as Record<string, string>)
          : {};
        mainCode = `import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sStorageApi = kc.makeApiClient(k8s.StorageV1Api);

const storageClassManifest: k8s.V1StorageClass = {
  apiVersion: 'storage.k8s.io/v1',
  kind: 'StorageClass',
  metadata: { name: '${config.name}-storageclass' },
  provisioner: '${config.storageClassProvisioner}',
  parameters: ${JSON.stringify(parametersObjK, null, 8)}
};

export async function createStorageClass() {
  try {
    const response = await k8sStorageApi.createStorageClass(storageClassManifest);
    return response.body;
  } catch (error) {
    console.error('Error creating StorageClass:', error);
    throw error;
  }
}`;
        break;
      default:
        mainCode = '';
    }
    let secondaryCode = '';
    if (secondaryResourceOptions[resourceType] && secondaryResourceOptions[resourceType].length > 0 && secondaryResourceType && secondaryResourceType !== '' && secondaryResourceType !== 'None') {
      switch (secondaryResourceType) {
        case 'pvc':
          secondaryCode = `// --- Secondary: PVC ---\n// ... k8s client pvc code ...`;
          break;
        case 'secret':
          secondaryCode = `// --- Secondary: Secret ---\n// ... k8s client secret code ...`;
          break;
        case 'configmap':
          secondaryCode = `// --- Secondary: ConfigMap ---\n// ... k8s client configmap code ...`;
          break;
        case 'ingress':
          secondaryCode = `// --- Secondary: Ingress ---\n// ... k8s client ingress code ...`;
          break;
        case 'deployment':
          secondaryCode = `// --- Secondary: Deployment ---\n// ... k8s client deployment code ...`;
          break;
        default:
          secondaryCode = '';
      }
    }
    return [mainCode, secondaryCode].filter(Boolean).join('\n\n// --- Secondary Resource ---\n\n');
  };

  const generateK8sYaml = () => {
    let manifest: any = {};
    const labels = parseLabels(config.labels);
    const envVars = parseEnvVars(config.env);
    switch (resourceType) {
      case 'deployment':
        manifest = {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: config.name,
            namespace: config.namespace,
            labels: { ...labels },
            ...(config.annotations ? { annotations: parseLabels(config.annotations) } : {}),
          },
          spec: {
            replicas: config.replicas,
            selector: { matchLabels: { ...labels } },
            ...(config.strategy ? { strategy: { type: config.strategy } } : {}),
            ...(config.minReadySeconds ? { minReadySeconds: Number(config.minReadySeconds) } : {}),
            template: {
              metadata: { labels: { ...labels } },
              spec: {
                containers: [
                  {
                    name: config.name,
                    image: config.image,
                    ports: [{ containerPort: config.port }],
                    env: envVars,
                    resources: {
                      requests: { cpu: config.cpu, memory: config.memory },
                      limits: { cpu: config.cpuLimit, memory: config.memoryLimit },
                    },
                    // 自动联动 configmap/secret
                    ...(secondaryResourceType === 'configmap' ? {
                      envFrom: [
                        { configMapRef: { name: `${config.name}-config` } }
                      ]
                    } : {}),
                    ...(secondaryResourceType === 'secret' ? {
                      envFrom: [
                        { secretRef: { name: `${config.name}-secret` } }
                      ]
                    } : {}),
                  },
                ],
              },
            },
          },
        };
        // 联动二级 PVC，自动挂载
        if (secondaryResourceType === 'pvc') {
          manifest.spec.template.spec.containers[0].volumeMounts = [
            {
              name: `${config.name}-pvc`,
              mountPath: '/mnt/data',
            },
          ];
          manifest.spec.template.spec.volumes = [
            {
              name: `${config.name}-pvc`,
              persistentVolumeClaim: {
                claimName: `${config.name}-pvc`,
              },
            },
          ];
        }
        // 联动二级 configmap/secret，支持挂载
        if ((secondaryResourceType === 'configmap' || secondaryResourceType === 'secret') && config.volumeMountPath) {
          const volName = `${config.name}-${secondaryResourceType}`;
          manifest.spec.template.spec.containers[0].volumeMounts = [
            ...(manifest.spec.template.spec.containers[0].volumeMounts || []),
            {
              name: volName,
              mountPath: config.volumeMountPath,
              readOnly: true,
            },
          ];
          manifest.spec.template.spec.volumes = [
            ...(manifest.spec.template.spec.volumes || []),
            secondaryResourceType === 'configmap'
              ? { name: volName, configMap: { name: `${config.name}-config` } }
              : { name: volName, secret: { secretName: `${config.name}-secret` } },
          ];
        }
        break;
      case 'service':
        manifest = {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: `${config.name}-service`,
            namespace: config.namespace,
            labels: { ...labels },
            ...(config.annotations ? { annotations: parseLabels(config.annotations) } : {}),
          },
          spec: {
            type: config.serviceType,
            ports: [{ port: 80, targetPort: config.port, protocol: 'TCP' }],
            selector: { ...labels },
            ...(config.externalIPs ? { externalIPs: config.externalIPs.split(',').map(ip => ip.trim()) } : {}),
            ...(config.sessionAffinity ? { sessionAffinity: config.sessionAffinity } : {}),
          },
        };
        break;
      case 'configmap':
        const configData = envVars.reduce((acc: Record<string, string>, env) => {
          acc[env.name] = env.value;
          return acc;
        }, {} as Record<string, string>);
        manifest = {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: `${config.name}-config`,
            namespace: config.namespace,
            ...(config.annotations ? { annotations: parseLabels(config.annotations) } : {}),
          },
          ...(config.configmapType ? { type: config.configmapType } : {}),
          data: configData,
        };
        break;
      case 'secret':
        const secretData = config.secretData.split(',').reduce((acc: Record<string, string>, pair) => {
          const [k, v] = pair.split('=');
          if (k && v) acc[k.trim()] = btoa(v.trim());
          return acc;
        }, {} as Record<string, string>);
        manifest = {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: {
            name: `${config.name}-secret`,
            namespace: config.namespace,
            labels: { ...labels },
            ...(config.annotations ? { annotations: parseLabels(config.annotations) } : {}),
          },
          type: config.secretType,
          data: secretData,
        };
        break;
      case 'ingress':
        manifest = {
          apiVersion: 'networking.k8s.io/v1',
          kind: 'Ingress',
          metadata: {
            name: `${config.name}-ingress`,
            namespace: config.namespace,
            labels: { ...labels },
            ...(config.annotations ? { annotations: parseLabels(config.annotations) } : {}),
          },
          spec: {
            ...(config.ingressClassName ? { ingressClassName: config.ingressClassName } : {}),
            rules: [
              {
                host: config.ingressHost,
                http: {
                  paths: [
                    {
                      path: config.ingressPath,
                      pathType: 'Prefix',
                      backend: {
                        service: {
                          name: config.ingressService,
                          port: { number: config.ingressServicePort },
                        },
                      },
                    },
                  ],
                },
              },
            ],
            ...(secondaryResourceType === 'secret' ? {
              tls: [
                {
                  hosts: [config.ingressHost],
                  secretName: `${config.name}-secret`
                },
              ],
            } : {}),
          },
        };
        break;
      case 'pvc':
        // 只要主副有一方为 storageclass，另一方为 pvc，就强制 storageClassName
        const hasStorageClass = String(resourceType) === 'storageclass' || String(secondaryResourceType) === 'storageclass';
        const storageClassNameFinal = config.secondaryStorageClassName || `${config.name}-storageclass`;
        manifest = {
          apiVersion: 'v1',
          kind: 'PersistentVolumeClaim',
          metadata: {
            name: `${config.name}-pvc`,
            namespace: config.namespace,
            labels: { ...labels },
            ...(config.annotations ? { annotations: parseLabels(config.annotations) } : {}),
          },
          spec: {
            accessModes: [config.pvcAccessModes],
            resources: {
              requests: {
                storage: config.pvcStorage,
              },
            },
            ...(hasStorageClass
              ? { storageClassName: storageClassNameFinal }
              : (config.pvcStorageClass ? { storageClassName: config.pvcStorageClass } : {})),
            ...(config.volumeMode ? { volumeMode: config.volumeMode } : {}),
          },
        };
        break;
      case 'storageclass':
        // StorageClass YAML 生成
        const parametersObjY = config.storageClassParameters
          ? config.storageClassParameters.split(',').reduce((acc: Record<string, string>, pair) => {
              const [k, v] = pair.split('=');
              if (k && v) acc[k.trim()] = v.trim();
              return acc;
            }, {} as Record<string, string>)
          : {};
        manifest = {
          apiVersion: 'storage.k8s.io/v1',
          kind: 'StorageClass',
          metadata: { name: config.secondaryStorageClassName || `${config.name}-storageclass` },
          provisioner: config.storageClassProvisioner,
          ...(Object.keys(parametersObjY).length > 0 ? { parameters: parametersObjY } : {}),
        };
        break;
      default:
        manifest = {};
    }
    if (secondaryResourceOptions[resourceType] && secondaryResourceOptions[resourceType].length > 0 && secondaryResourceType && secondaryResourceType !== '' && secondaryResourceType !== 'None') {
      let secondaryManifest: any;
      switch (secondaryResourceType) {
        case 'pvc':
          secondaryManifest = {
            apiVersion: 'v1',
            kind: 'PersistentVolumeClaim',
            metadata: {
              name: `${config.name}-pvc`,
              namespace: config.namespace,
              labels: { ...labels },
              ...(config.annotations ? { annotations: parseLabels(config.annotations) } : {}),
            },
            spec: {
              accessModes: [config.pvcAccessModes],
              resources: {
                requests: {
                  storage: config.pvcStorage,
                },
              },
              ...(String(secondaryResourceType) === 'storageclass'
                ? { storageClassName: config.secondaryStorageClassName || `${config.name}-storageclass` }
                : (config.pvcStorageClass ? { storageClassName: config.pvcStorageClass } : {})),
              ...(config.volumeMode ? { volumeMode: config.volumeMode } : {}),
            },
          };
          break;
        case 'secret':
          if (resourceType === 'ingress') {
            secondaryManifest = {
              apiVersion: 'v1',
              kind: 'Secret',
              metadata: {
                name: `${config.name}-secret`,
                namespace: config.namespace,
                labels: { ...labels },
              },
              type: 'kubernetes.io/tls',
            };
          } else {
            secondaryManifest = {
              apiVersion: 'v1',
              kind: 'Secret',
              metadata: {
                name: `${config.name}-secret`,
                namespace: config.namespace,
                labels: { ...labels },
              },
              type: config.secretType,
              data: config.secretData.split(',').reduce((acc: Record<string, string>, pair) => {
                const [k, v] = pair.split('=');
                if (k && v) acc[k.trim()] = btoa(v.trim());
                return acc;
              }, {} as Record<string, string>),
            };
          }
          break;
        case 'configmap':
          const configData = parseEnvVars(config.env).reduce((acc: Record<string, string>, env: { name: string, value: string }) => {
            acc[env.name] = env.value;
            return acc;
          }, {} as Record<string, string>);
          secondaryManifest = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
              name: `${config.name}-config`,
              namespace: config.namespace,
            },
            ...(config.configmapType ? { type: config.configmapType } : {}),
            data: configData,
          };
          break;
        case 'ingress':
          secondaryManifest = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
              name: `${config.name}-ingress`,
              namespace: config.namespace,
              labels: { ...labels },
            },
            spec: {
              rules: [
                {
                  host: config.ingressHost,
                  http: {
                    paths: [
                      {
                        path: config.ingressPath,
                        pathType: 'Prefix',
                        backend: {
                          service: {
                            name: config.ingressService,
                            port: { number: config.ingressServicePort },
                          },
                        },
                      },
                    ],
                  },
                },
              ],
              ...(resourceType === 'secret' && config.secretType === 'kubernetes.io/tls'
                ? {
                    tls: [
                      {
                        hosts: [config.ingressHost],
                        secretName: `${config.name}-secret`,
                      },
                    ],
                  }
                : {}),
            },
          };
          break;
        case 'deployment':
          secondaryManifest = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
              name: config.name,
              namespace: config.namespace,
              labels: { ...labels },
            },
            spec: {
              replicas: config.replicas,
              selector: { matchLabels: { ...labels } },
              template: {
                metadata: { labels: { ...labels } },
                spec: {
                  containers: [
                    {
                      name: config.name,
                      image: config.image,
                      ports: [{ containerPort: config.port }],
                      env: envVars,
                      resources: {
                        requests: { cpu: config.cpu, memory: config.memory },
                        limits: { cpu: config.cpuLimit, memory: config.memoryLimit },
                      },
                      // 主副调换：主资源为 configmap/secret 时自动联动
                      ...(resourceType === 'configmap' ? {
                        envFrom: [
                          { configMapRef: { name: `${config.name}-config` } }
                        ]
                      } : {}),
                      ...(resourceType === 'secret' ? {
                        envFrom: [
                          { secretRef: { name: `${config.name}-secret` } }
                        ]
                      } : {}),
                    },
                  ],
                  // 主副调换：如填写挂载路径，自动挂载
                  ...((resourceType === 'configmap' || resourceType === 'secret') && config.volumeMountPath ? {
                    volumes: [
                      resourceType === 'configmap'
                        ? { name: `${config.name}-configmap`, configMap: { name: `${config.name}-config` } }
                        : { name: `${config.name}-secret`, secret: { secretName: `${config.name}-secret` } },
                    ],
                  } : {}),
                },
              },
            },
          };
          // 主副调换：如填写挂载路径，自动挂载 volumeMounts
          if ((resourceType === 'configmap' || resourceType === 'secret') && config.volumeMountPath) {
            secondaryManifest.spec.template.spec.containers[0].volumeMounts = [
              {
                name: resourceType === 'configmap' ? `${config.name}-configmap` : `${config.name}-secret`,
                mountPath: config.volumeMountPath,
                readOnly: true,
              },
            ];
          }
          break;
        case 'storageclass':
          // 二级资源联动：pvc 的二级 storageclass
          secondaryManifest = {
            apiVersion: 'storage.k8s.io/v1',
            kind: 'StorageClass',
            metadata: { name: config.secondaryStorageClassName || `${config.name}-storageclass` },
            provisioner: config.storageClassProvisioner,
            ...(config.storageClassParameters ? { parameters: config.storageClassParameters.split(',').reduce((acc: Record<string, string>, pair) => {
              const [k, v] = pair.split('=');
              if (k && v) acc[k.trim()] = v.trim();
              return acc;
            }, {} as Record<string, string>) } : {}),
          };
          break;
        default:
          return yamlStringify(manifest);
      }
      if (secondaryManifest) {
        return `${yamlStringify(manifest)}---\n${yamlStringify(secondaryManifest)}`;
      }
    }
    return yamlStringify(manifest);
  };

  const generateCode = () => {
    let code = '';
    let k8sYaml = '';
    try {
      switch (iacFramework) {
        case 'cdk8s':
          code = generateCDK8sCode();
          break;
        case 'pulumi':
          code = generatePulumiCode();
          break;
        case 'kubernetes-client':
          code = generateK8sClientCode();
          break;
        default:
          code = generateCDK8sCode();
          break;
      }
      k8sYaml = generateK8sYaml();
      setGeneratedCode(typeof code === 'string' ? code : '');
      setGeneratedYaml(k8sYaml);
      setActiveTab(activeTab === 'yaml' ? 'yaml' : 'code');
    } catch (e) {
      setGeneratedYaml('');
      setActiveTab('code');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
  };

  const downloadCode = () => {
    const fileExtension = iacFramework === 'cdk8s' ? 'ts' : 'ts';
    const blob = new Blob([generatedCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name}-${resourceType}-${iacFramework}.${fileExtension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyYamlToClipboard = () => {
    navigator.clipboard.writeText(generatedYaml);
  };

  const handleConfigChange = (key: string, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleResourceTypeChange = (value: string) => {
    setResourceType(value);
    setActiveTab('form');
  };

  const handleIacFrameworkChange = (value: string) => {
    setIacFramework(value);
    if (activeTab === 'code') {
      let code = '';
      switch (value) {
        case 'cdk8s':
          code = generateCDK8sCode();
          break;
        case 'pulumi':
          code = generatePulumiCode();
          break;
        case 'kubernetes-client':
          code = generateK8sClientCode();
          break;
        default:
          code = generateCDK8sCode();
      }
      setGeneratedCode(code);
    }
  };

  // Secondary Configuration表单
  const renderSecondaryConfigForm = () => {
    if (!secondaryResourceType) return null;
    switch (secondaryResourceType) {
      case 'secret':
        if (resourceType === 'ingress') {
          const crtValue = (config.secretData.split(',').find(s => s.trim().startsWith('tls.crt=')) || '').split('=')[1] || '';
          const keyValue = (config.secretData.split(',').find(s => s.trim().startsWith('tls.key=')) || '').split('=')[1] || '';
          return (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Secret Type</label>
                <select
                  value={config.secretType}
                  onChange={(e) => handleConfigChange('secretType', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  disabled
                >
                  <option value="kubernetes.io/tls">kubernetes.io/tls</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">tls.crt</label>
                <input
                  type="text"
                  value={crtValue}
                  onChange={e => {
                    const newVal = `tls.crt=${e.target.value},tls.key=${keyValue}`;
                    handleConfigChange('secretData', newVal);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder="证书内容"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">tls.key</label>
                <input
                  type="text"
                  value={keyValue}
                  onChange={e => {
                    const newVal = `tls.crt=${crtValue},tls.key=${e.target.value}`;
                    handleConfigChange('secretData', newVal);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder="私钥内容"
                />
              </div>
            </>
          );
        }
        // 其余情况不渲染特殊表单
        return null;
      case 'configmap':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">ConfigMap Type (可选)</label>
            <input
              type="text"
              value={config.configmapType}
              onChange={(e) => handleConfigChange('configmapType', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
              placeholder=""
            />
          </div>
        );
      case 'pvc':
        // 主为 storageclass 副为 pvc 时，渲染副 PVC 的表单项（name、storage、accessModes、storageClassName）
        if (String(resourceType) === 'storageclass' && String(secondaryResourceType) === 'pvc') {
          return (
            <>
              <div>
                <label htmlFor="secondary-pvc-name" className="block text-sm font-medium text-gray-300 mb-2">PVC Name</label>
                <input
                  id="secondary-pvc-name"
                  name="secondary-pvc-name"
                  type="text"
                  value={config.secondaryPvcName || `${config.name}-pvc`}
                  onChange={e => handleConfigChange('secondaryPvcName', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder={`${config.name}-pvc`}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="secondary-pvc-storage" className="block text-sm font-medium text-gray-300 mb-2">Storage</label>
                  <input
                    id="secondary-pvc-storage"
                    name="secondary-pvc-storage"
                    type="text"
                    value={config.pvcStorage}
                    onChange={(e) => handleConfigChange('pvcStorage', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                    placeholder="1Gi"
                  />
                </div>
                <div>
                  <label htmlFor="secondary-pvc-access-modes" className="block text-sm font-medium text-gray-300 mb-2">Access Modes</label>
                  <input
                    id="secondary-pvc-access-modes"
                    name="secondary-pvc-access-modes"
                    type="text"
                    value={config.pvcAccessModes}
                    onChange={(e) => handleConfigChange('pvcAccessModes', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                    placeholder="ReadWriteOnce"
                  />
                </div>
                <div>
                  <label htmlFor="secondary-pvc-storage-class" className="block text-sm font-medium text-gray-300 mb-2">StorageClassName</label>
                  <input
                    id="secondary-pvc-storage-class"
                    name="secondary-pvc-storage-class"
                    type="text"
                    value={config.name}
                    disabled
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  />
                </div>
              </div>
            </>
          );
        }
        // 主为 deployment 副为 pvc 时，渲染副 PVC 的表单项
        if (String(resourceType) === 'deployment' && String(secondaryResourceType) === 'pvc') {
          return (
            <>
              <div>
                <label htmlFor="secondary-pvc-name" className="block text-sm font-medium text-gray-300 mb-2">PVC Name</label>
                <input
                  id="secondary-pvc-name"
                  name="secondary-pvc-name"
                  type="text"
                  value={config.secondaryPvcName || `${config.name}-pvc`}
                  onChange={e => handleConfigChange('secondaryPvcName', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder={`${config.name}-pvc`}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="secondary-pvc-storage" className="block text-sm font-medium text-gray-300 mb-2">Storage</label>
                  <input
                    id="secondary-pvc-storage"
                    name="secondary-pvc-storage"
                    type="text"
                    value={config.pvcStorage}
                    onChange={(e) => handleConfigChange('pvcStorage', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                    placeholder="1Gi"
                  />
                </div>
                <div>
                  <label htmlFor="secondary-pvc-access-modes" className="block text-sm font-medium text-gray-300 mb-2">Access Modes</label>
                  <input
                    id="secondary-pvc-access-modes"
                    name="secondary-pvc-access-modes"
                    type="text"
                    value={config.pvcAccessModes}
                    onChange={(e) => handleConfigChange('pvcAccessModes', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                    placeholder="ReadWriteOnce"
                  />
                </div>
                <div>
                  <label htmlFor="secondary-pvc-storage-class" className="block text-sm font-medium text-gray-300 mb-2">StorageClassName (可选)</label>
                  <input
                    id="secondary-pvc-storage-class"
                    name="secondary-pvc-storage-class"
                    type="text"
                    value={config.pvcStorageClass}
                    onChange={e => handleConfigChange('pvcStorageClass', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                    placeholder=""
                  />
                </div>
              </div>
            </>
          );
        }
        // 主为 pvc 副为 storageclass 时，渲染 storageclass name
        if (String(resourceType) === 'pvc' && String(secondaryResourceType) === 'storageclass') {
          return (
            <div>
              <label htmlFor="secondary-storageclass-name" className="block text-sm font-medium text-gray-300 mb-2">StorageClass Name</label>
              <input
                id="secondary-storageclass-name"
                name="secondary-storageclass-name"
                type="text"
                value={config.secondaryStorageClassName || `${config.name}-storageclass`}
                onChange={e => handleConfigChange('secondaryStorageClassName', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder={`${config.name}-storageclass`}
              />
            </div>
          );
        }
        // 其他情况，渲染 PVC name
        return (
          <div>
            <label htmlFor="secondary-pvc-name" className="block text-sm font-medium text-gray-300 mb-2">PVC Name</label>
            <input
              id="secondary-pvc-name"
              name="secondary-pvc-name"
              type="text"
              value={config.secondaryPvcName || `${config.name}-pvc`}
              onChange={e => handleConfigChange('secondaryPvcName', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
              placeholder={`${config.name}-pvc`}
            />
          </div>
        );
      case 'ingress':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Host</label>
                <input
                  type="text"
                  value={config.ingressHost}
                  onChange={(e) => handleConfigChange('ingressHost', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder="example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Path</label>
                <input
                  type="text"
                  value={config.ingressPath}
                  onChange={(e) => handleConfigChange('ingressPath', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder="/"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Service Name</label>
                <input
                  type="text"
                  value={config.ingressService}
                  onChange={(e) => handleConfigChange('ingressService', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder="my-app-service"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Service Port</label>
                <input
                  type="number"
                  value={config.ingressServicePort}
                  onChange={(e) => handleConfigChange('ingressServicePort', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder="80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">IngressClass Name (可选)</label>
                <input
                  type="text"
                  value={config.ingressClassName}
                  onChange={(e) => handleConfigChange('ingressClassName', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                  placeholder="nginx"
                />
              </div>
            </div>
          </>
        );
      case 'deployment':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Image</label>
              <input
                type="text"
                value={config.image}
                onChange={e => handleConfigChange('image', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder="nginx:latest"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Replicas</label>
              <input
                type="number"
                value={config.replicas}
                onChange={(e) => handleConfigChange('replicas', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Port</label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Labels (key=value,逗号分隔)</label>
              <input
                type="text"
                value={config.labels}
                onChange={(e) => handleConfigChange('labels', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder="app=my-app,version=v1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Env (key=value,逗号分隔)</label>
              <input
                type="text"
                value={config.env}
                onChange={(e) => handleConfigChange('env', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder={resourceType === 'deployment' ? 'NODE_ENV=production,PORT=3000' : 'KEY1=value1,KEY2=value2'}
              />
            </div>
          </>
        );
      case 'storageclass':
        return (
          <>
            <div>
              <label htmlFor="secondary-storageclass-name" className="block text-sm font-medium text-gray-300 mb-2">StorageClass Name</label>
              <input
                id="secondary-storageclass-name"
                name="secondary-storageclass-name"
                type="text"
                value={config.secondaryStorageClassName || `${config.name}-storageclass`}
                onChange={e => handleConfigChange('secondaryStorageClassName', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder={`${config.name}-storageclass`}
              />
            </div>
            <div>
              <label htmlFor="storageclass-provisioner" className="block text-sm font-medium text-gray-300 mb-2">Provisioner</label>
              <input
                id="storageclass-provisioner"
                name="storageclass-provisioner"
                type="text"
                value={config.storageClassProvisioner}
                onChange={e => handleConfigChange('storageClassProvisioner', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder="kubernetes.io/aws-ebs"
              />
            </div>
            <div>
              <label htmlFor="storageclass-parameters" className="block text-sm font-medium text-gray-300 mb-2">Parameters (key=value,逗号分隔)</label>
              <input
                id="storageclass-parameters"
                name="storageclass-parameters"
                type="text"
                value={config.storageClassParameters}
                onChange={e => handleConfigChange('storageClassParameters', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder="type=gp2,encrypted=true"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Kubernetes TypeScript IaC Generator
          </h1>
          <p className="text-gray-300 text-lg">
            Generate TypeScript Infrastructure as Code for Kubernetes resources
          </p>
        </div>

        {/* Framework Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">Select IaC Framework</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {iacFrameworks.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => handleIacFrameworkChange(value)}
                className={`p-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                  iacFramework === value
                    ? 'border-purple-500 bg-purple-900/50 text-purple-200 shadow-lg shadow-purple-500/25'
                    : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-purple-400 hover:bg-purple-900/30'
                }`}
              >
                <div className="text-lg font-semibold mb-1">{label}</div>
                <div className="text-sm opacity-75">{description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Resource Type Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">Select Resource Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {resourceTypes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleResourceTypeChange(value)}
                className={`p-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                  resourceType === value
                    ? 'border-blue-500 bg-blue-900/50 text-blue-200 shadow-lg shadow-blue-500/25'
                    : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-blue-400 hover:bg-blue-900/30'
                }`}
              >
                <Icon className="mx-auto mb-2 h-6 w-6" />
                <div className="text-sm font-medium">{label}</div>
              </button>
            ))}
          </div>
          {/* 二级资源类型选择 */}
          {secondaryResourceOptions[resourceType] && secondaryResourceOptions[resourceType].length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Select Secondary Resource Type (optional)</label>
              <select
                value={secondaryResourceType}
                onChange={e => setSecondaryResourceType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
              >
                <option value="">None</option>
                {secondaryResourceOptions[resourceType].map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg border border-gray-600">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${
                activeTab === 'form'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-blue-400'
              }`}
            >
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${
                activeTab === 'code'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-blue-400'
              }`}
            >
              TypeScript Code
            </button>
            <button
              onClick={() => setActiveTab('yaml')}
              className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${
                activeTab === 'yaml'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-blue-400'
              }`}
            >
              Kubernetes YAML
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Configuration Form */}
          {activeTab === 'form' && (
            <div className="w-full">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl p-6 border border-gray-600">
                <h3 className="text-lg font-semibold mb-6 text-white flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  Configuration
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={config.name}
                        onChange={(e) => handleConfigChange('name', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        placeholder="my-app"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Namespace
                      </label>
                      <input
                        type="text"
                        value={config.namespace}
                        onChange={(e) => handleConfigChange('namespace', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        placeholder="default"
                      />
                    </div>
                  </div>

                  {resourceType === 'deployment' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Container Image
                        </label>
                        <input
                          type="text"
                          value={config.image}
                          onChange={(e) => handleConfigChange('image', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                          placeholder="nginx:latest"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Replicas
                          </label>
                          <input
                            type="number"
                            value={config.replicas}
                            onChange={(e) => handleConfigChange('replicas', parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Port
                          </label>
                          <input
                            type="number"
                            value={config.port}
                            onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            CPU Request
                          </label>
                          <input
                            type="text"
                            value={config.cpu}
                            onChange={(e) => handleConfigChange('cpu', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="100m"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Memory Request
                          </label>
                          <input
                            type="text"
                            value={config.memory}
                            onChange={(e) => handleConfigChange('memory', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="128Mi"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            CPU Limit
                          </label>
                          <input
                            type="text"
                            value={config.cpuLimit}
                            onChange={(e) => handleConfigChange('cpuLimit', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="500m"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Memory Limit
                          </label>
                          <input
                            type="text"
                            value={config.memoryLimit}
                            onChange={(e) => handleConfigChange('memoryLimit', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="256Mi"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {resourceType === 'service' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Target Port
                        </label>
                        <input
                          type="number"
                          value={config.port}
                          onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Service Type
                        </label>
                        <select
                          value={config.serviceType}
                          onChange={(e) => handleConfigChange('serviceType', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        >
                          <option value="ClusterIP">ClusterIP</option>
                          <option value="NodePort">NodePort</option>
                          <option value="LoadBalancer">LoadBalancer</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Labels (key=value, separated by commas)
                    </label>
                    <input
                      type="text"
                      value={config.labels}
                      onChange={(e) => handleConfigChange('labels', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                      placeholder="app=my-app,version=v1"
                    />
                  </div>

                  {(resourceType === 'deployment' || resourceType === 'configmap') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {resourceType === 'deployment' ? 'Environment Variables' : 'Config Data'} (KEY=value, separated by commas)
                      </label>
                      <input
                        type="text"
                        value={config.env}
                        onChange={(e) => handleConfigChange('env', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        placeholder={resourceType === 'deployment' ? 'NODE_ENV=production,PORT=3000' : 'KEY1=value1,KEY2=value2'}
                      />
                    </div>
                  )}

                  {/* Secret 表单 */}
                  {resourceType === 'secret' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Secret Type
                        </label>
                        <select
                          value={config.secretType}
                          onChange={(e) => handleConfigChange('secretType', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        >
                          <option value="Opaque">Opaque</option>
                          <option value="kubernetes.io/dockerconfigjson">kubernetes.io/dockerconfigjson</option>
                          <option value="kubernetes.io/tls">kubernetes.io/tls</option>
                          <option value="kubernetes.io/basic-auth">kubernetes.io/basic-auth</option>
                          <option value="kubernetes.io/ssh-auth">kubernetes.io/ssh-auth</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Secret Data (KEY=value, separated by commas)
                        </label>
                        <input
                          type="text"
                          value={config.secretData}
                          onChange={(e) => handleConfigChange('secretData', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                          placeholder="username=admin,password=123456"
                        />
                      </div>
                    </>
                  )}

                  {/* ConfigMap 表单 */}
                  {resourceType === 'configmap' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        ConfigMap Type (可选)
                      </label>
                      <input
                        type="text"
                        value={config.configmapType}
                        onChange={(e) => handleConfigChange('configmapType', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        placeholder=""
                      />
                    </div>
                  )}

                  {/* Ingress 表单 */}
                  {resourceType === 'ingress' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Host</label>
                          <input
                            type="text"
                            value={config.ingressHost}
                            onChange={(e) => handleConfigChange('ingressHost', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Path</label>
                          <input
                            type="text"
                            value={config.ingressPath}
                            onChange={(e) => handleConfigChange('ingressPath', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="/"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Service Name</label>
                          <input
                            type="text"
                            value={config.ingressService}
                            onChange={(e) => handleConfigChange('ingressService', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="my-app-service"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Service Port</label>
                          <input
                            type="number"
                            value={config.ingressServicePort}
                            onChange={(e) => handleConfigChange('ingressServicePort', parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="80"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">IngressClass Name (可选)</label>
                          <input
                            type="text"
                            value={config.ingressClassName}
                            onChange={(e) => handleConfigChange('ingressClassName', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="nginx"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* PVC 表单 */}
                  {resourceType === 'pvc' && (
                    <>
                      <div>
                        <label htmlFor="secondary-pvc-name" className="block text-sm font-medium text-gray-300 mb-2">PVC Name</label>
                        <input
                          id="secondary-pvc-name"
                          name="secondary-pvc-name"
                          type="text"
                          value={config.secondaryPvcName || `${config.name}-pvc`}
                          onChange={e => handleConfigChange('secondaryPvcName', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                          placeholder={`${config.name}-pvc`}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="secondary-pvc-storage" className="block text-sm font-medium text-gray-300 mb-2">Storage</label>
                          <input
                            id="secondary-pvc-storage"
                            name="secondary-pvc-storage"
                            type="text"
                            value={config.pvcStorage}
                            onChange={(e) => handleConfigChange('pvcStorage', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="1Gi"
                          />
                        </div>
                        <div>
                          <label htmlFor="secondary-pvc-access-modes" className="block text-sm font-medium text-gray-300 mb-2">Access Modes</label>
                          <input
                            id="secondary-pvc-access-modes"
                            name="secondary-pvc-access-modes"
                            type="text"
                            value={config.pvcAccessModes}
                            onChange={(e) => handleConfigChange('pvcAccessModes', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder="ReadWriteOnce"
                          />
                        </div>
                        <div>
                          <label htmlFor="secondary-pvc-storage-class" className="block text-sm font-medium text-gray-300 mb-2">StorageClassName (可选)</label>
                          <input
                            id="secondary-pvc-storage-class"
                            name="secondary-pvc-storage-class"
                            type="text"
                            value={
                              // 主为storageclass副为pvc时，联动主表单Name字段
                              (String(resourceType) === 'storageclass' && String(secondaryResourceType) === 'pvc')
                                ? config.name
                                : ((String(resourceType) === 'pvc' && String(secondaryResourceType) === 'storageclass')
                                  ? (config.secondaryStorageClassName || `${config.name}-storageclass`)
                                  : config.pvcStorageClass)
                            }
                            onChange={(e) => handleConfigChange('pvcStorageClass', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder=""
                            disabled={
                              (String(resourceType) === 'storageclass' && String(secondaryResourceType) === 'pvc') ||
                              (String(resourceType) === 'pvc' && String(secondaryResourceType) === 'storageclass')
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* 二级资源表单 */}
                  {secondaryResourceOptions[resourceType] && secondaryResourceOptions[resourceType].length > 0 && secondaryResourceType && secondaryResourceType !== '' && secondaryResourceType !== 'None' && (
                    <>
                      <div className="border-t border-gray-600 my-4"></div>
                      <h4 className="text-md font-semibold text-white mb-2">Secondary Configuration</h4>
                      {renderSecondaryConfigForm()}
                    </>
                  )}

                  {resourceType === 'deployment' && (secondaryResourceType === 'configmap' || secondaryResourceType === 'secret') && (
                    <div>
                      <label htmlFor="volume-mount-path" className="block text-sm font-medium text-gray-300 mb-2">挂载路径 (可选, 如 /etc/config)</label>
                      <input
                        id="volume-mount-path"
                        name="volume-mount-path"
                        type="text"
                        value={config.volumeMountPath}
                        onChange={e => handleConfigChange('volumeMountPath', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        placeholder="/etc/config"
                      />
                    </div>
                  )}

                  <div className="flex space-x-4 mt-6">
                    <button
                      onClick={generateCode}
                      className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <Code className="mr-2 h-5 w-5" />
                      Generate Code
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TypeScript Code 区域 */}
          {activeTab === 'code' && (
            <div className="w-full">
              <div className="bg-gray-900/70 rounded-xl shadow-xl p-6 border border-gray-700 flex flex-col h-full">
                <h3 className="text-lg font-semibold mb-6 text-white flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Generated TypeScript Code
                </h3>
                <div className="flex-1 overflow-auto bg-gray-800 rounded-lg p-4 mb-4 text-sm text-blue-100 font-mono whitespace-pre-wrap">
                  {generatedCode || '// Click "Generate Code" to see the output here.'}
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </button>
                  <button
                    onClick={downloadCode}
                    className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* YAML 区域 */}
          {activeTab === 'yaml' && (
            <div className="w-full">
              <div className="bg-gray-900/70 rounded-xl shadow-xl p-6 border border-gray-700 flex flex-col h-full">
                <h3 className="text-lg font-semibold mb-6 text-white flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Generated Kubernetes YAML
                </h3>
                <div className="flex-1 overflow-auto bg-gray-800 rounded-lg p-4 mb-4 text-sm text-blue-100 font-mono whitespace-pre-wrap">
                  {generatedYaml || '# Click "Generate Code" to see the YAML here.'}
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={copyYamlToClipboard}
                    className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy YAML
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default K8sTypeScriptIaCGenerator;