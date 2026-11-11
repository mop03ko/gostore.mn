"""Import temporary signing material, verify the IPA, upload, and clean up.

GOSTORE_IOS_SIGNING is an encrypted Actions secret, never a repository file.
Its keys: certificateP12, certificatePassword, provisioningProfile, keyP8,
keyIdentifier, issuerIdentifier. No credential values are logged.
"""
import base64
import json
import os
from pathlib import Path
import plistlib
import secrets
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
TEMP = Path(os.environ.get('RUNNER_TEMP', '/tmp')).resolve() / 'gostore-ios-signing'
KEYCHAIN = TEMP / 'build.keychain-db'
PROFILE_DIRS = [Path.home() / 'Library/MobileDevice/Provisioning Profiles',
                Path.home() / 'Library/Developer/Xcode/UserData/Provisioning Profiles']


def run(*args, capture=False):
    return subprocess.run(args, check=True, capture_output=capture).stdout


def credentials():
    data = json.loads(os.environ['GOSTORE_IOS_SIGNING'])
    for key in ('certificateP12', 'certificatePassword', 'provisioningProfile',
                'keyP8', 'keyIdentifier', 'issuerIdentifier'):
        if not data.get(key):
            raise ValueError('Missing signing field: ' + key)
    return data


def prepare():
    data = credentials()
    TEMP.mkdir(mode=0o700, parents=True, exist_ok=True)
    p12 = TEMP / 'certificate.p12'
    profile_file = TEMP / 'profile.mobileprovision'
    p12.write_bytes(base64.b64decode(data['certificateP12']))
    profile_file.write_bytes(base64.b64decode(data['provisioningProfile']))
    profile = plistlib.loads(run('security', 'cms', '-D', '-i', str(profile_file), capture=True))
    if profile['Entitlements']['application-identifier'] != '8P6PVVWKUB.mn.gostore.app':
        raise ValueError('Wrong app provisioning profile')
    if profile['Entitlements'].get('get-task-allow') or profile.get('ProvisionedDevices'):
        raise ValueError('An App Store distribution profile is required')
    uuid = profile['UUID']
    (TEMP / 'profile-uuid').write_text(uuid)
    for directory in PROFILE_DIRS:
        directory.mkdir(parents=True, exist_ok=True)
        shutil.copy2(profile_file, directory / (uuid + '.mobileprovision'))
    password = secrets.token_urlsafe(32)
    run('security', 'create-keychain', '-p', password, str(KEYCHAIN))
    run('security', 'set-keychain-settings', '-lut', '21600', str(KEYCHAIN))
    run('security', 'unlock-keychain', '-p', password, str(KEYCHAIN))
    run('security', 'import', str(p12), '-k', str(KEYCHAIN), '-P', data['certificatePassword'],
        '-T', '/usr/bin/codesign', '-T', '/usr/bin/security', capture=True)
    run('security', 'set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s',
        '-k', password, str(KEYCHAIN), capture=True)
    run('security', 'list-keychains', '-d', 'user', '-s', str(KEYCHAIN),
        str(Path.home() / 'Library/Keychains/login.keychain-db'))
    options = {'method': 'app-store-connect', 'teamID': '8P6PVVWKUB',
               'signingStyle': 'manual', 'signingCertificate': 'Apple Distribution',
               'provisioningProfiles': {'mn.gostore.app': uuid},
               'manageAppVersionAndBuildNumber': False, 'uploadSymbols': True}
    (TEMP / 'ExportOptions.plist').write_bytes(plistlib.dumps(options))
    print('Existing App Store signing identity imported into a temporary keychain.')


def verify():
    files = list((ROOT / 'output/ios-mac').glob('*.ipa'))
    if len(files) != 1:
        raise ValueError('Expected exactly one IPA')
    with zipfile.ZipFile(files[0]) as archive:
        paths = [p for p in archive.namelist() if p.startswith('Payload/')
                 and p.endswith('.app/Info.plist') and p.count('/') == 2]
        if len(paths) != 1:
            raise ValueError('Expected one main app')
        info = plistlib.loads(archive.read(paths[0]))
        version = json.loads((ROOT / 'gostoremn/app.json').read_text())['expo']['version']
        expected = {'CFBundleIdentifier': 'mn.gostore.app',
                    'CFBundleShortVersionString': version, 'CFBundleVersion': os.environ['BUILD_NUMBER']}
        if any(info.get(k) != v for k, v in expected.items()):
            raise ValueError('IPA identity/version mismatch')
        print(json.dumps({'verified': expected, 'ipa': files[0].name}))
    return files[0]


def upload():
    ipa = verify()
    data = credentials()
    key_dir = TEMP / 'private_keys'
    key_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    key = key_dir / ('AuthKey_' + data['keyIdentifier'] + '.p8')
    key.write_text(data['keyP8'])
    key.chmod(0o600)
    env = dict(os.environ, API_PRIVATE_KEYS_DIR=str(key_dir))
    env.pop('GOSTORE_IOS_SIGNING', None)
    subprocess.run(['xcrun', 'altool', '--upload-app', '--type', 'ios', '--file', str(ipa),
                    '--apiKey', data['keyIdentifier'], '--apiIssuer', data['issuerIdentifier']],
                   env=env, check=True)


def cleanup():
    if KEYCHAIN.exists():
        subprocess.run(['security', 'delete-keychain', str(KEYCHAIN)], check=False,
                       capture_output=True)
    uuid_file = TEMP / 'profile-uuid'
    if uuid_file.exists():
        uuid = uuid_file.read_text().strip()
        if not all(c in '0123456789abcdefABCDEF-' for c in uuid):
            raise ValueError('Invalid profile UUID')
        for directory in PROFILE_DIRS:
            (directory / (uuid + '.mobileprovision')).unlink(missing_ok=True)
    if TEMP.exists():
        shutil.rmtree(TEMP)


if __name__ == '__main__':
    os.umask(0o077)
    commands = {'prepare': prepare, 'verify': verify, 'upload': upload, 'cleanup': cleanup}
    commands[sys.argv[1]]()
