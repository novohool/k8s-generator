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
    secondaryConfigMapName: '',
    secondaryConfigMapLabels: '',
    secondaryConfigMapAnnotations: '',
    secondaryConfigMapImmutable: 'false',
    secondaryConfigMapData: '',
    secondarySecretName: '',
    secondarySecretLabels: '',
    secondarySecretAnnotations: '',
    secondarySecretImmutable: 'false',
    secondarySecretType: 'Opaque',
    secondarySecretData: '',
    mountData: '',
    secondaryServiceName: '',
    secondaryServicePort: 80,
    secondaryServiceType: 'ClusterIP',
    secondaryServiceLabels: '',
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
      { value: 'service', label: 'Service' },
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
          secondaryCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.secondaryPvcName || config.name + 'Pvc'} = new k8s.core.v1.PersistentVolumeClaim("${config.secondaryPvcName || config.name + '-pvc'}", {
  metadata: {
    name: "${config.secondaryPvcName || config.name + '-pvc'}",
    namespace: "${config.namespace}",
    labels: ${JSON.stringify(parseLabels(config.labels), null, 8)}
  },
  spec: {
    accessModes: ["${config.pvcAccessModes}"],
    resources: {
      requests: {
        storage: "${config.pvcStorage}"
      }
    },
    storageClassName: ${(resourceType === 'storageclass' && secondaryResourceType === 'pvc')
      ? `"${config.name}-storageclass"`
      : (`"${config.secondaryStorageClassName || config.pvcStorageClass || ''}"`)},
    ${(config.volumeMode ? `volumeMode: "${config.volumeMode}",` : '')}
  }
});
export const secondaryPvcName = ${config.secondaryPvcName || config.name + 'Pvc'}.metadata.name;`;
          break;
        case 'secret': {
          const secretData = (config.secondarySecretData || '').split('\n').reduce((acc: Record<string, string>, line) => {
            const [k, v] = line.split('=');
            if (k && v !== undefined && v !== '') acc[k.trim()] = v.trim();
            return acc;
          }, {} as Record<string, string>);
          secondaryCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.secondarySecretName || config.name + 'Secret'} = new k8s.core.v1.Secret("${config.secondarySecretName || config.name + '-secret'}", {
  metadata: {
    name: "${config.secondarySecretName || config.name + '-secret'}",
    namespace: "${config.namespace}",
    labels: ${JSON.stringify(parseLabels(config.secondarySecretLabels || config.labels), null, 8)}
  },
  type: "${config.secondarySecretType || 'Opaque'}",
  stringData: ${JSON.stringify(secretData, null, 8)}
});
export const secondarySecretName = ${config.secondarySecretName || config.name + 'Secret'}.metadata.name;`;
          break;
        }
        case 'configmap': {
          const configMapData = (config.secondaryConfigMapData || '').split('\n').reduce((acc: Record<string, string>, line) => {
            const [k, v] = line.split('=');
            if (k && v !== undefined && v !== '') acc[k.trim()] = v.trim();
            return acc;
          }, {} as Record<string, string>);
          secondaryCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.secondaryConfigMapName || config.name + 'ConfigMap'} = new k8s.core.v1.ConfigMap("${config.secondaryConfigMapName || config.name + '-config'}", {
  metadata: {
    name: "${config.secondaryConfigMapName || config.name + '-config'}",
    namespace: "${config.namespace}",
    labels: ${JSON.stringify(parseLabels(config.secondaryConfigMapLabels || config.labels), null, 8)}
  },
  data: ${JSON.stringify(configMapData, null, 8)}
});
export const secondaryConfigMapName = ${config.secondaryConfigMapName || config.name + 'ConfigMap'}.metadata.name;`;
          break;
        }
        case 'deployment': {
          const envVars = parseEnvVars(config.env);
          secondaryCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.name}SecondaryDeployment = new k8s.apps.v1.Deployment("${config.name}-deployment", {
  metadata: {
    name: "${config.name}",
    namespace: "${config.namespace}",
    labels: ${JSON.stringify(parseLabels(config.labels), null, 8)}
  },
  spec: {
    replicas: ${config.replicas},
    selector: { matchLabels: ${JSON.stringify(parseLabels(config.labels), null, 12)} },
    template: {
      metadata: { labels: ${JSON.stringify(parseLabels(config.labels), null, 16)} },
      spec: {
        containers: [{
          name: "${config.name}",
          image: "${config.image}",
          ports: [{ containerPort: ${config.port} }],
          env: [${envVars.map(env => `\n            { name: \"${env.name}\", value: \"${env.value}\" }`).join(',')}\n          ],
          resources: {
            requests: { cpu: "${config.cpu}", memory: "${config.memory}" },
            limits: { cpu: "${config.cpuLimit}", memory: "${config.memoryLimit}" }
          }
        }]
      }
    }
  }
});
export const secondaryDeploymentName = ${config.name}SecondaryDeployment.metadata.name;`;
          break;
        }
        case 'storageclass': {
          const parametersObjP = config.storageClassParameters
            ? config.storageClassParameters.split(',').reduce((acc: Record<string, string>, pair) => {
                const [k, v] = pair.split('=');
                if (k && v) acc[k.trim()] = v.trim();
                return acc;
              }, {} as Record<string, string>)
            : {};
          secondaryCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.secondaryStorageClassName || config.name + 'StorageClass'} = new k8s.storage.v1.StorageClass("${config.secondaryStorageClassName || config.name + '-storageclass'}", {
  metadata: { name: "${config.secondaryStorageClassName || config.name + '-storageclass'}" },
  provisioner: "${config.storageClassProvisioner}",
  parameters: ${JSON.stringify(parametersObjP, null, 8)}
});
export const secondaryStorageClassName = ${config.secondaryStorageClassName || config.name + 'StorageClass'}.metadata.name;`;
          break;
        }
        case 'service': {
          // 主为 ingress 时，默认值联动主 ingress 的 serviceName/servicePort/labels
          const defaultName = resourceType === 'ingress' ? config.ingressService : (config.secondaryServiceName || `${config.name}-service`);
          const defaultPort = resourceType === 'ingress' ? config.ingressServicePort : (config.secondaryServicePort || 80);
          const defaultLabels = resourceType === 'ingress' ? config.labels : (config.secondaryServiceLabels || '');
          secondaryCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.secondaryServiceName || config.name + 'Service'} = new k8s.core.v1.Service("${config.secondaryServiceName || config.name + '-service'}", {
  metadata: {
    name: "${config.secondaryServiceName || config.name + '-service'}",
    namespace: "${config.namespace}",
    labels: ${JSON.stringify(parseLabels(config.secondaryServiceLabels || config.labels), null, 8)}
  },
  spec: {
    type: "${config.secondaryServiceType || 'ClusterIP'}",
    ports: [{
      port: ${config.secondaryServicePort || defaultPort},
      targetPort: ${config.secondaryServicePort || defaultPort},
      protocol: "TCP"
    }],
    selector: ${JSON.stringify(parseLabels(config.secondaryServiceLabels || config.labels), null, 8)}
  }
});
export const secondaryServiceName = ${config.secondaryServiceName || config.name + 'Service'}.metadata.name;`;
          break;
        }
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
        case 'service': {
          // 主为 ingress 时，默认值联动主 ingress 的 serviceName/servicePort/labels
          const defaultName = resourceType === 'ingress' ? config.ingressService : (config.secondaryServiceName || `${config.name}-service`);
          const defaultPort = resourceType === 'ingress' ? config.ingressServicePort : (config.secondaryServicePort || 80);
          const defaultLabels = resourceType === 'ingress' ? config.labels : (config.secondaryServiceLabels || '');
          secondaryCode = `import * as k8s from "@pulumi/kubernetes";

const ${config.secondaryServiceName || config.name + 'Service'} = new k8s.core.v1.Service("${config.secondaryServiceName || config.name + '-service'}", {
  metadata: {
    name: "${config.secondaryServiceName || config.name + '-service'}",
    namespace: "${config.namespace}",
    labels: ${JSON.stringify(parseLabels(config.secondaryServiceLabels || config.labels), null, 8)}
  },
  spec: {
    type: "${config.secondaryServiceType || 'ClusterIP'}",
    ports: [{
      port: ${config.secondaryServicePort || defaultPort},
      targetPort: ${config.secondaryServicePort || defaultPort},
      protocol: "TCP"
    }],
    selector: ${JSON.stringify(parseLabels(config.secondaryServiceLabels || config.labels), null, 8)}
  }
});
export const secondaryServiceName = ${config.secondaryServiceName || config.name + 'Service'}.metadata.name;`;
          break;
        }
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
        case 'service': {
          // 主为 ingress 时，默认值联动主 ingress 的 serviceName/servicePort/labels
          const defaultName = resourceType === 'ingress' ? config.ingressService : (config.secondaryServiceName || `${config.name}-service`);
          const defaultPort = resourceType === 'ingress' ? config.ingressServicePort : (config.secondaryServicePort || 80);
          const defaultLabels = resourceType === 'ingress' ? config.labels : (config.secondaryServiceLabels || '');
          secondaryCode = `import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

const secondaryServiceManifest: k8s.V1Service = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: {
    name: '${config.secondaryServiceName || config.name + '-service'}',
    namespace: '${config.namespace}',
    labels: ${JSON.stringify(parseLabels(config.secondaryServiceLabels || config.labels), null, 8)}
  },
  spec: {
    type: '${config.secondaryServiceType || 'ClusterIP'}',
    ports: [{
      port: ${config.secondaryServicePort || defaultPort},
      targetPort: ${config.secondaryServicePort || defaultPort},
      protocol: "TCP"
    }],
    selector: ${JSON.stringify(parseLabels(config.secondaryServiceLabels || config.labels), null, 8)}
  }
};

export async function createSecondaryService() {
  try {
    const response = await k8sCoreApi.createNamespacedService(
      '${config.namespace}',
      secondaryServiceManifest
    );
    return response.body;
  } catch (error) {
    console.error('Error creating secondary Service:', error);
    throw error;
  }
}`;
          break;
        }
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
              name: config.secondaryPvcName || `${config.name}-pvc`,
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
              storageClassName: (resourceType === 'storageclass' && secondaryResourceType === 'pvc')
                ? `${config.name}-storageclass`
                : (config.secondaryStorageClassName || config.pvcStorageClass),
              ...(config.volumeMode ? { volumeMode: config.volumeMode } : {}),
            },
          };
          break;
        case 'secret': {
          // 解析副级 Secret 字段
          const name = config.secondarySecretName || `${config.name}-secret`;
          const labels = config.secondarySecretLabels ? parseLabels(config.secondarySecretLabels) : parseLabels(config.labels);
          const annotations = config.secondarySecretAnnotations ? parseLabels(config.secondarySecretAnnotations) : {};
          const immutable = config.secondarySecretImmutable === 'true';
          const type = config.secondarySecretType || config.secretType || 'Opaque';
          let data: Record<string, string> = {};
          // 根据不同类型处理 Secret Data
          if (type === 'kubernetes.io/tls') {
            // tls.crt, tls.key
            const crt = (config.secondarySecretData || '').split('\n').find(s => s.trim().startsWith('tls.crt=')) || '';
            const key = (config.secondarySecretData || '').split('\n').find(s => s.trim().startsWith('tls.key=')) || '';
            const crtVal = crt.split('=')[1] || '';
            const keyVal = key.split('=')[1] || '';
            if (crtVal) data['tls.crt'] = btoa(crtVal);
            if (keyVal) data['tls.key'] = btoa(keyVal);
          } else if (type === 'kubernetes.io/dockerconfigjson') {
            // 只允许 .dockerconfigjson 字段
            const dockerVal = (config.secondarySecretData || '').split('=')[1] || '';
            if (dockerVal) data['.dockerconfigjson'] = btoa(dockerVal);
          } else if (type === 'kubernetes.io/basic-auth') {
            // username, password
            const lines = (config.secondarySecretData || '').split('\n');
            lines.forEach(line => {
              const [k, v] = line.split('=');
              if (k && v !== undefined && v !== '') data[k.trim()] = btoa(v.trim());
            });
          } else if (type === 'kubernetes.io/ssh-auth') {
            // ssh-privatekey
            const keyVal = (config.secondarySecretData || '').split('=')[1] || '';
            if (keyVal) data['ssh-privatekey'] = btoa(keyVal);
          } else {
            // Opaque 或其他类型
            const lines = (config.secondarySecretData || '').split('\n');
            lines.forEach(line => {
              const [k, v] = line.split('=');
              if (k && v !== undefined && v !== '') data[k.trim()] = btoa(v.trim());
            });
          }
          secondaryManifest = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
              name,
              namespace: config.namespace,
              labels: { ...labels },
              annotations: { ...annotations },
            },
            immutable,
            type,
            data,
          };
          break;
        }
        case 'configmap': {
          // 解析副级 ConfigMap 字段
          const name = config.secondaryConfigMapName || `${config.name}-config`;
          const labels = config.secondaryConfigMapLabels ? parseLabels(config.secondaryConfigMapLabels) : parseLabels(config.labels);
          const annotations = config.secondaryConfigMapAnnotations ? parseLabels(config.secondaryConfigMapAnnotations) : {};
          const immutable = config.secondaryConfigMapImmutable === 'true';
          const data = (config.secondaryConfigMapData || '').split('\n').reduce((acc: Record<string, string>, line) => {
            const [k, v] = line.split('=');
            if (k && v !== undefined && v !== '') acc[k.trim()] = v.trim();
            return acc;
          }, {} as Record<string, string>);
          secondaryManifest = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
              name,
              namespace: config.namespace,
              labels: { ...labels },
              annotations: { ...annotations },
            },
            immutable,
            data,
          };
          break;
        }
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
        case 'service': {
          // 无论主为 ingress 还是其他，副为 service 时都渲染 Service Name 输入框
          const name = config.secondaryServiceName || (resourceType === 'ingress' ? (config.ingressService || `${config.name}-service`) : `${config.name}-service`);
          const port = config.secondaryServicePort || (resourceType === 'ingress' ? config.ingressServicePort : 80);
          const labels = config.secondaryServiceLabels ? parseLabels(config.secondaryServiceLabels) : parseLabels(config.labels);
          secondaryManifest = {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: {
              name,
              namespace: config.namespace,
              labels,
            },
            spec: {
              type: config.secondaryServiceType || 'ClusterIP',
              ports: [{ port: 80, targetPort: port, protocol: 'TCP' }],
              selector: labels,
            },
          };
          break;
        }
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
        // 其他情况补全表单
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Secret Name</label>
              <input
                type="text"
                value={config.secondarySecretName || `${config.name}-secret`}
                onChange={e => handleConfigChange('secondarySecretName', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder={`${config.name}-secret`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Secret Type</label>
              <select
                value={config.secondarySecretType || 'Opaque'}
                onChange={e => handleConfigChange('secondarySecretType', e.target.value)}
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Secret Data (key=value,每行一对)</label>
              <textarea
                value={config.secondarySecretData || ''}
                onChange={e => handleConfigChange('secondarySecretData', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                rows={4}
                placeholder={"username=admin\npassword=123456"}
              />
            </div>
          </>
        );
      case 'configmap':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">ConfigMap Name</label>
              <input
                type="text"
                value={config.secondaryConfigMapName || `${config.name}-config`}
                onChange={e => handleConfigChange('secondaryConfigMapName', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder={`${config.name}-config`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Labels (key=value,逗号分隔)</label>
              <input
                type="text"
                value={config.secondaryConfigMapLabels || ''}
                onChange={e => handleConfigChange('secondaryConfigMapLabels', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder="env=prod,app=demo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Annotations (key=value,逗号分隔)</label>
              <input
                type="text"
                value={config.secondaryConfigMapAnnotations || ''}
                onChange={e => handleConfigChange('secondaryConfigMapAnnotations', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder="creator=ai"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Immutable</label>
              <select
                value={config.secondaryConfigMapImmutable || 'false'}
                onChange={e => handleConfigChange('secondaryConfigMapImmutable', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Config Data (key=value,每行一对)</label>
              <textarea
                value={config.secondaryConfigMapData || ''}
                onChange={e => handleConfigChange('secondaryConfigMapData', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                rows={4}
                placeholder={"key1=value1\nkey2=value2"}
              />
            </div>
          </>
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
                  <label htmlFor="secondary-pvc-storage-class" className="block text-sm font-medium text-gray-300 mb-2">StorageClassName (可选)</label>
                  <input
                    id="secondary-pvc-storage-class"
                    name="secondary-pvc-storage-class"
                    type="text"
                    value={
                      (resourceType === 'storageclass' && secondaryResourceType === 'pvc')
                        ? `${config.name}-storageclass`
                        : (config.secondaryStorageClassName || '')
                    }
                    onChange={e => handleConfigChange('secondaryStorageClassName', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                    placeholder=""
                    disabled={resourceType === 'storageclass' && secondaryResourceType === 'pvc'}
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
                    value={
                      (resourceType === 'storageclass' && secondaryResourceType === 'pvc')
                        ? `${config.name}-storageclass`
                        : (config.secondaryStorageClassName || '')
                    }
                    onChange={e => handleConfigChange('secondaryStorageClassName', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                    placeholder=""
                    disabled={resourceType === 'storageclass' && secondaryResourceType === 'pvc'}
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
        // 其他情况，渲染 PVC name + StorageClassName
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
            <div>
              <label htmlFor="secondary-pvc-storage-class" className="block text-sm font-medium text-gray-300 mb-2">StorageClassName (可选)</label>
              <input
                id="secondary-pvc-storage-class"
                name="secondary-pvc-storage-class"
                type="text"
                value={
                  (resourceType === 'storageclass' && secondaryResourceType === 'pvc')
                    ? `${config.name}-storageclass`
                    : (config.secondaryStorageClassName || '')
                }
                onChange={e => handleConfigChange('secondaryStorageClassName', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                placeholder=""
                disabled={resourceType === 'storageclass' && secondaryResourceType === 'pvc'}
              />
            </div>
          </>
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
                              (resourceType === 'storageclass' && secondaryResourceType === 'pvc')
                                ? `${config.name}-storageclass`
                                : (config.secondaryStorageClassName || '')
                            }
                            onChange={e => handleConfigChange('secondaryStorageClassName', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                            placeholder=""
                            disabled={resourceType === 'storageclass' && secondaryResourceType === 'pvc'}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* 二级资源表单 */}
                  {secondaryResourceOptions[resourceType] && secondaryResourceOptions[resourceType].length > 0 && secondaryResourceType && secondaryResourceType !== '' && secondaryResourceType !== 'None' && (
                    <div className="bg-gray-800/50 rounded-lg p-4 mt-4 border border-gray-600">
                      <div className="border-b border-gray-600 mb-4 pb-2">
                        <h4 className="text-md font-semibold text-white">Secondary Configuration</h4>
                      </div>
                      {renderSecondaryConfigForm()}
                    </div>
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
                      <label htmlFor="mount-data" className="block text-sm font-medium text-gray-300 mb-2 mt-4">挂载数据 (key=value, 每行一对)</label>
                      <textarea
                        id="mount-data"
                        name="mount-data"
                        value={config.mountData || ''}
                        onChange={e => handleConfigChange('mountData', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white"
                        rows={4}
                        placeholder={"key1=value1\nkey2=value2"}
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