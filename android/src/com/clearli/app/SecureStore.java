package com.clearli.app;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * AES-256-GCM encrypted blobs in app-private storage. The key never leaves the
 * Android Keystore (hardware-backed on most devices), so the files are useless if copied off.
 */
final class SecureStore {
    private static final String ALIAS = "clearli_master_v1";
    private final File dir;

    SecureStore(Context ctx) {
        dir = new File(ctx.getFilesDir(), "vault");
        if (!dir.exists()) dir.mkdirs();
    }

    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return kg.generateKey();
    }

    synchronized void write(String name, String plain) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key());
        byte[] iv = c.getIV();
        byte[] ct = c.doFinal(plain.getBytes("UTF-8"));
        File tmp = new File(dir, name + ".tmp");
        FileOutputStream fo = new FileOutputStream(tmp);
        fo.write(iv.length);
        fo.write(iv);
        fo.write(ct);
        fo.getFD().sync();
        fo.close();
        File dst = new File(dir, name + ".enc");
        if (!tmp.renameTo(dst)) {
            dst.delete();
            if (!tmp.renameTo(dst)) throw new Exception("rename failed");
        }
    }

    synchronized String read(String name) throws Exception {
        File f = new File(dir, name + ".enc");
        if (!f.exists()) return null;
        byte[] all = new byte[(int) f.length()];
        FileInputStream fi = new FileInputStream(f);
        int off = 0;
        while (off < all.length) {
            int n = fi.read(all, off, all.length - off);
            if (n < 0) break;
            off += n;
        }
        fi.close();
        int ivLen = all[0] & 0xff;
        byte[] iv = new byte[ivLen];
        System.arraycopy(all, 1, iv, 0, ivLen);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        byte[] pt = c.doFinal(all, 1 + ivLen, all.length - 1 - ivLen);
        return new String(pt, "UTF-8");
    }

    synchronized void delete(String name) {
        new File(dir, name + ".enc").delete();
        new File(dir, name + ".tmp").delete();
    }

    synchronized void deleteKey() {
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            ks.deleteEntry(ALIAS);
        } catch (Exception ignored) { }
    }
}
